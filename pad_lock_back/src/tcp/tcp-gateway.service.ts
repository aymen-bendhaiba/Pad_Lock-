import {
  BadRequestException,
  forwardRef,
  Inject,
  GatewayTimeoutException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket, createServer, Server } from 'node:net';
import { DataSource, In, Repository } from 'typeorm';
import {
  Geofence,
  GeofenceAccessMode,
  GeofenceRules,
} from '../geofences/geofence.entity';
import { GeofenceDeviceState } from '../geofences/geofence-device-state.entity';
import {
  GeofenceTransition,
  GeofenceTransitionType,
} from '../geofences/geofence-transition.entity';
import {
  isLockAccessAllowedByGeofence,
  isPointInGeofence,
} from '../geofences/geofence-geometry';
import { LockEventType } from '../lock-events/lock-event.entity';
import { LockEventsService } from '../lock-events/lock-events.service';
import { LockConfigurationsService } from '../lock-configurations/lock-configurations.service';
import { LockDeviceStatus } from '../locks/lock-device.entity';
import { LocksService } from '../locks/locks.service';
import { PositionsService } from '../positions/positions.service';
import {
  buildRfidAddCommand,
  buildRfidDeleteCommand,
  buildUnlockChannelsSetCommand,
} from '../protocol/jt701d-commands';
import {
  RfidCard,
  RfidCardRole,
  RfidCardSyncStatus,
} from '../rfid/rfid-card.entity';
import {
  parseAsciiFrame,
  ParsedAsciiFrame,
} from './parsers/jt701d-ascii.parser';
import {
  parseJt701dBinary,
  ParsedJt701dBinary,
} from './parsers/jt701d-binary.parser';

type DeviceSocket = Socket & {
  buffer?: Buffer;
  lastSerial?: number | null;
  terminalId?: string;
};

type PendingRfidRequest = {
  resolve: (value: RfidTcpResponse) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
};

type PendingCommandRequest<T> = {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
  parser: (parts: string[]) => T;
};

export type RfidTcpResponse = {
  success: true;
  opType: number;
  count: number;
  cards: string[];
};

@Injectable()
export class TcpGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TcpGatewayService.name);
  private readonly connectedDevices = new Map<string, DeviceSocket>();
  private readonly deviceChannelState = new Map<string, GeofenceRules>();
  private readonly pendingRfidRequests = new Map<string, PendingRfidRequest>();
  private readonly pendingCommandRequests = new Map<
    string,
    PendingCommandRequest<unknown>
  >();
  private server: Server | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly lockEventsService: LockEventsService,
    private readonly positionsService: PositionsService,
    private readonly locksService: LocksService,
    @Inject(forwardRef(() => LockConfigurationsService))
    private readonly lockConfigurationsService: LockConfigurationsService,
    private readonly dataSource: DataSource,
    @InjectRepository(Geofence)
    private readonly geofencesRepository: Repository<Geofence>,
    @InjectRepository(GeofenceDeviceState)
    private readonly geofenceStatesRepository: Repository<GeofenceDeviceState>,
    @InjectRepository(GeofenceTransition)
    private readonly geofenceTransitionsRepository: Repository<GeofenceTransition>,
    @InjectRepository(RfidCard)
    private readonly rfidCardsRepository: Repository<RfidCard>,
  ) {}

  onModuleInit() {
    const host = this.config.getOrThrow<string>('TCP_HOST');
    const port = this.config.getOrThrow<number>('TCP_PORT');

    this.server = createServer((socket: DeviceSocket) =>
      this.handleSocket(socket),
    );
    this.server.listen(port, host, () => {
      this.logger.log(`JT701D TCP listener ready on ${host}:${port}`);
    });
  }

  onModuleDestroy() {
    for (const pending of this.pendingRfidRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('TCP service is shutting down'));
    }

    this.pendingRfidRequests.clear();

    for (const pending of this.pendingCommandRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('TCP service is shutting down'));
    }

    this.pendingCommandRequests.clear();

    for (const socket of this.connectedDevices.values()) {
      socket.destroy();
    }

    this.connectedDevices.clear();
    this.server?.close();
  }

  sendRfidCommand(
    terminalId: string,
    command: string,
  ): Promise<RfidTcpResponse> {
    const normalizedTerminalId = terminalId.toUpperCase();
    const socket = this.connectedDevices.get(normalizedTerminalId);

    if (!socket) {
      throw new BadRequestException('Lock is not connected over TCP');
    }

    const timeoutMs = this.config.getOrThrow<number>('TCP_COMMAND_TIMEOUT_MS');

    return new Promise((resolve, reject) => {
      const previous = this.pendingRfidRequests.get(normalizedTerminalId);
      if (previous) {
        clearTimeout(previous.timeout);
        previous.reject(new Error('Superseded by a newer RFID request'));
      }

      const timeout = setTimeout(() => {
        this.pendingRfidRequests.delete(normalizedTerminalId);
        reject(
          new GatewayTimeoutException(
            `Lock did not answer RFID command within ${timeoutMs / 1000}s`,
          ),
        );
      }, timeoutMs);

      this.pendingRfidRequests.set(normalizedTerminalId, {
        resolve,
        reject,
        timeout,
      });

      socket.write(command);
    });
  }

  sendCommand<T>(
    terminalId: string,
    commandWord: string,
    command: string,
    parser: (parts: string[]) => T,
  ): Promise<T> {
    const normalizedTerminalId = terminalId.toUpperCase();
    const socket = this.connectedDevices.get(normalizedTerminalId);

    if (!socket) {
      throw new BadRequestException('Lock is not connected over TCP');
    }

    const timeoutMs = this.config.getOrThrow<number>('TCP_COMMAND_TIMEOUT_MS');
    const key = this.pendingKey(normalizedTerminalId, commandWord);

    return new Promise((resolve, reject) => {
      const previous = this.pendingCommandRequests.get(key);
      if (previous) {
        clearTimeout(previous.timeout);
        previous.reject(
          new Error(`Superseded by a newer ${commandWord} request`),
        );
      }

      const timeout = setTimeout(() => {
        this.pendingCommandRequests.delete(key);
        reject(
          new GatewayTimeoutException(
            `Lock did not answer ${commandWord} command within ${
              timeoutMs / 1000
            }s`,
          ),
        );
      }, timeoutMs);

      this.pendingCommandRequests.set(key, {
        resolve: resolve,
        reject,
        timeout,
        parser: parser,
      });

      socket.write(command);
    });
  }

  sendCommandNoWait(terminalId: string, command: string) {
    const normalizedTerminalId = terminalId.toUpperCase();
    const socket = this.connectedDevices.get(normalizedTerminalId);

    if (!socket) {
      throw new BadRequestException('Lock is not connected over TCP');
    }

    socket.write(command);

    return {
      success: true,
      message: 'Command sent to connected lock.',
    };
  }

  isConnected(terminalId: string): boolean {
    return this.connectedDevices.has(terminalId.toUpperCase());
  }

  private handleSocket(socket: DeviceSocket) {
    socket.buffer = Buffer.alloc(0);
    socket.lastSerial = null;

    socket.on('data', (chunk) => {
      socket.buffer = Buffer.concat([socket.buffer ?? Buffer.alloc(0), chunk]);
      this.processBuffer(socket).catch((error: unknown) => {
        this.logger.error(
          error instanceof Error ? error.message : String(error),
        );
      });
    });

    socket.on('error', (error) => {
      this.logger.error(`TCP socket error: ${error.message}`);
    });

    socket.on('close', () => {
      if (socket.terminalId) {
        this.connectedDevices.delete(socket.terminalId);
        this.locksService
          .update(socket.terminalId, { status: LockDeviceStatus.Offline })
          .catch((error: unknown) => {
            this.logger.warn(
              `Could not mark ${socket.terminalId} offline: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });
        this.logger.log(`Lock ${socket.terminalId} disconnected`);
      }
    });
  }

  private async processBuffer(socket: DeviceSocket): Promise<void> {
    while ((socket.buffer?.length ?? 0) > 0) {
      const buffer = socket.buffer as Buffer;
      const firstByte = buffer[0];

      if (firstByte === 0x24) {
        if (buffer.length < 10) {
          return;
        }

        const bodyLength = (buffer[8] << 8) | buffer[9];
        const totalPacketLength = 10 + bodyLength;

        if (buffer.length < totalPacketLength) {
          return;
        }

        const data = buffer.subarray(0, totalPacketLength);
        socket.buffer = buffer.subarray(totalPacketLength);
        await this.handleBinaryFrame(socket, data);
        continue;
      }

      if (firstByte === 0x28) {
        const endIndex = buffer.indexOf(0x29);

        if (endIndex === -1) {
          return;
        }

        const data = buffer.subarray(0, endIndex + 1);
        socket.buffer = buffer.subarray(endIndex + 1);
        await this.handleAsciiFrame(socket, data.toString('ascii'));
        continue;
      }

      socket.buffer = buffer.subarray(1);
    }
  }

  private async handleBinaryFrame(
    socket: DeviceSocket,
    data: Buffer,
  ): Promise<void> {
    const parsed = parseJt701dBinary(data);
    this.registerSocket(parsed.terminalId, socket);
    await this.recordBinaryEvent(parsed);

    const serialNumber = data[data.length - 1];
    socket.lastSerial = serialNumber;
    socket.write(`(P69,0,${serialNumber})`);
  }

  private async handleAsciiFrame(
    socket: DeviceSocket,
    frame: string,
  ): Promise<void> {
    const parsed = parseAsciiFrame(frame);

    if (!parsed) {
      return;
    }

    this.registerSocket(parsed.terminalId, socket);

    if (parsed.kind === 'time_sync') {
      socket.write(`(P22,${this.formatProtocolTime(new Date())})`);
      return;
    }

    if (parsed.kind === 'rfid_response') {
      this.resolveRfidRequest(parsed);
      return;
    }

    if (parsed.kind === 'p45_report') {
      await this.recordP45Event(parsed);
      socket.write(`(P69,0,${parsed.serialNumber || 0})`);
      return;
    }

    if (
      parsed.kind === 'command_response' &&
      this.resolveCommandRequest(parsed)
    ) {
      return;
    }

    socket.write(`(${parsed.terminalId},P69,0,0)`);
  }

  private registerSocket(terminalId: string, socket: DeviceSocket): void {
    const normalizedTerminalId = terminalId.toUpperCase();
    const isNewConnection =
      this.connectedDevices.get(normalizedTerminalId) !== socket;
    socket.terminalId = normalizedTerminalId;
    this.connectedDevices.set(normalizedTerminalId, socket);

    if (isNewConnection) {
      void this.lockConfigurationsService
        .retryPendingForLock(normalizedTerminalId)
        .catch((error: unknown) => {
          this.logger.warn(
            `Could not retry lock configuration for ${normalizedTerminalId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
    }
  }

  private resolveRfidRequest(
    parsed: Extract<ParsedAsciiFrame, { kind: 'rfid_response' }>,
  ) {
    const pending = this.pendingRfidRequests.get(
      parsed.terminalId.toUpperCase(),
    );

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRfidRequests.delete(parsed.terminalId.toUpperCase());
    pending.resolve({
      success: true,
      opType: parsed.opType,
      count: parsed.count,
      cards: parsed.cards,
    });
  }

  private resolveCommandRequest(
    parsed: Extract<ParsedAsciiFrame, { kind: 'command_response' }>,
  ): boolean {
    const key = this.pendingKey(parsed.terminalId, parsed.command);
    const pending = this.pendingCommandRequests.get(key);

    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingCommandRequests.delete(key);
    pending.resolve(pending.parser(parsed.parts));
    return true;
  }

  private async recordBinaryEvent(parsed: ParsedJt701dBinary): Promise<void> {
    await this.recordBinaryPosition(parsed);

    if (parsed.dataType !== 2) {
      return;
    }

    const alarmTypes = this.alarmTypesFromBinary(parsed);

    for (const type of alarmTypes) {
      await this.safeRecordEvent(parsed.terminalId, {
        type,
        source: 'JT701D binary alarm',
        latitude: parsed.isPositioned ? parsed.latitude : null,
        longitude: parsed.isPositioned ? parsed.longitude : null,
        rawPayload: parsed,
        occurredAt: this.protocolDate(parsed.timestamp),
      });
    }
  }

  private async recordP45Event(
    parsed: Extract<ParsedAsciiFrame, { kind: 'p45_report' }>,
  ): Promise<void> {
    if (
      parsed.isPositioned &&
      parsed.latitude !== null &&
      parsed.longitude !== null
    ) {
      await this.safeRecordPosition(parsed.terminalId, {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        speedKmh: parsed.speedKmh,
        directionDegrees: parsed.directionDegrees,
        isLocked: parsed.eventSourceCode === '5',
        isPositioned: parsed.isPositioned,
        mileage: parsed.mileage,
        rawPayload: parsed,
        recordedAt: this.protocolDate(parsed.timestamp),
      });

      await this.applyGeofenceRules(
        parsed.terminalId,
        parsed.latitude,
        parsed.longitude,
      );
      await this.recordGeofenceTransitions(
        parsed.terminalId,
        parsed.latitude,
        parsed.longitude,
        this.protocolDate(parsed.timestamp),
      );
      await this.applyRfidGeofenceEnforcement(
        parsed.terminalId,
        parsed.latitude,
        parsed.longitude,
      );
    }

    await this.safeRecordEvent(parsed.terminalId, {
      type: this.eventTypeFromP45(parsed),
      source: parsed.eventSource,
      rfidCardNumber: parsed.rfidCard,
      latitude: parsed.isPositioned ? parsed.latitude : null,
      longitude: parsed.isPositioned ? parsed.longitude : null,
      rawPayload: parsed,
      occurredAt: this.protocolDate(parsed.timestamp),
    });
  }

  private async safeRecordEvent(
    terminalId: string,
    input: Parameters<LockEventsService['recordFromTcp']>[1],
  ): Promise<void> {
    try {
      const geofences =
        input.latitude !== null &&
        input.latitude !== undefined &&
        input.longitude !== null &&
        input.longitude !== undefined
          ? await this.geofenceSnapshots(input.latitude, input.longitude)
          : [];
      await this.lockEventsService.recordFromTcp(terminalId, {
        ...input,
        geofences,
      });
    } catch (error) {
      this.logger.warn(
        `Could not persist TCP event for ${terminalId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async recordBinaryPosition(
    parsed: ParsedJt701dBinary,
  ): Promise<void> {
    if (!parsed.isPositioned || ![1, 2, 3, 4].includes(parsed.dataType)) {
      return;
    }

    await this.safeRecordPosition(parsed.terminalId, {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      speedKmh: parsed.speedKmh,
      directionDegrees: parsed.directionDegrees,
      batteryPercentage: this.batteryPercentage(parsed.batteryLevel),
      isCharging: parsed.batteryLevel === 'Charging',
      isLocked: parsed.status.isMotorLocked,
      isPositioned: parsed.isPositioned,
      mileage: parsed.mileage,
      rawPayload: parsed,
      recordedAt: this.protocolDate(parsed.timestamp),
    });

    await this.applyGeofenceRules(
      parsed.terminalId,
      parsed.latitude,
      parsed.longitude,
    );
    await this.recordGeofenceTransitions(
      parsed.terminalId,
      parsed.latitude,
      parsed.longitude,
      this.protocolDate(parsed.timestamp),
    );
    await this.applyRfidGeofenceEnforcement(
      parsed.terminalId,
      parsed.latitude,
      parsed.longitude,
    );
  }

  private async safeRecordPosition(
    terminalId: string,
    input: Parameters<PositionsService['recordFromTcp']>[1],
  ): Promise<void> {
    try {
      await this.positionsService.recordFromTcp(terminalId, input);
    } catch (error) {
      this.logger.warn(
        `Could not persist TCP position for ${terminalId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async geofenceSnapshots(
    latitude: number,
    longitude: number,
  ): Promise<Array<{ id: string; name: string }>> {
    const geofences = await this.geofencesRepository.find();
    const snapshots: Array<{ id: string; name: string }> = [];

    for (const geofence of geofences) {
      if (await this.isPositionInGeofence(latitude, longitude, geofence)) {
        snapshots.push({ id: geofence.id, name: geofence.name });
      }
    }

    return snapshots;
  }

  private async recordGeofenceTransitions(
    terminalId: string,
    latitude: number,
    longitude: number,
    occurredAt: Date,
  ): Promise<void> {
    const normalizedTerminalId = terminalId.toUpperCase();
    const [geofences, states] = await Promise.all([
      this.geofencesRepository.find(),
      this.geofenceStatesRepository.find({
        where: { terminalId: normalizedTerminalId },
      }),
    ]);
    const stateByGeofence = new Map(
      states.map((state) => [state.geofenceId, state]),
    );

    for (const geofence of geofences) {
      const isInside = await this.isPositionInGeofence(
        latitude,
        longitude,
        geofence,
      );
      const state = stateByGeofence.get(geofence.id);

      if (!state) {
        await this.geofenceStatesRepository.save(
          this.geofenceStatesRepository.create({
            terminalId: normalizedTerminalId,
            geofenceId: geofence.id,
            isInside,
            lastObservedAt: occurredAt,
            lastChangedAt: isInside ? occurredAt : null,
          }),
        );

        if (isInside) {
          await this.saveGeofenceTransition(
            normalizedTerminalId,
            geofence,
            GeofenceTransitionType.Enter,
            latitude,
            longitude,
            occurredAt,
          );
        }
        continue;
      }

      state.lastObservedAt = occurredAt;

      if (state.isInside !== isInside) {
        state.isInside = isInside;
        state.lastChangedAt = occurredAt;
        await this.saveGeofenceTransition(
          normalizedTerminalId,
          geofence,
          isInside ? GeofenceTransitionType.Enter : GeofenceTransitionType.Exit,
          latitude,
          longitude,
          occurredAt,
        );
      }

      await this.geofenceStatesRepository.save(state);
    }
  }

  private saveGeofenceTransition(
    terminalId: string,
    geofence: Geofence,
    type: GeofenceTransitionType,
    latitude: number,
    longitude: number,
    occurredAt: Date,
  ): Promise<GeofenceTransition> {
    return this.geofenceTransitionsRepository.save(
      this.geofenceTransitionsRepository.create({
        terminalId,
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        type,
        latitude,
        longitude,
        occurredAt,
      }),
    );
  }

  private async applyGeofenceRules(
    terminalId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const geofences = await this.geofencesRepository.find();
    const mergedRules: GeofenceRules = {
      smsAllowed: true,
      gprsAllowed: true,
      rfidAllowed: true,
      serialAllowed: true,
      bluetoothAllowed: true,
      lockAccessAllowed: true,
    };

    for (const geofence of geofences) {
      const inShape = await this.isPositionInGeofence(
        latitude,
        longitude,
        geofence,
      );
      const lockAccessAllowed = this.isAccessModeAllowed(
        latitude,
        longitude,
        geofence,
        inShape,
      );

      if (inShape) {
        mergedRules.smsAllowed &&= geofence.rules.smsAllowed;
        mergedRules.gprsAllowed &&= geofence.rules.gprsAllowed;
        mergedRules.serialAllowed &&= geofence.rules.serialAllowed;
        mergedRules.bluetoothAllowed &&= geofence.rules.bluetoothAllowed;
      }

      mergedRules.lockAccessAllowed &&=
        lockAccessAllowed && geofence.rules.lockAccessAllowed;
    }

    const normalizedTerminalId = terminalId.toUpperCase();
    const cached = this.deviceChannelState.get(normalizedTerminalId);

    if (cached && sameRules(cached, mergedRules)) {
      return;
    }

    this.deviceChannelState.set(normalizedTerminalId, mergedRules);
    const socket = this.connectedDevices.get(normalizedTerminalId);

    if (!socket) {
      return;
    }

    socket.write(
      buildUnlockChannelsSetCommand({
        sms: mergedRules.smsAllowed,
        gprs: mergedRules.gprsAllowed,
        rfid: mergedRules.rfidAllowed,
        serial: mergedRules.serialAllowed,
        bluetooth: mergedRules.bluetoothAllowed,
      }),
    );
  }

  private async applyRfidGeofenceEnforcement(
    terminalId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const limitedCards = await this.rfidCardsRepository.find({
      where: {
        lockDeviceId: lockDevice.id,
        role: RfidCardRole.Limited,
        active: true,
      },
      order: { createdAt: 'ASC' },
    });

    if (limitedCards.length === 0) {
      return;
    }

    const allowed = await this.isLimitedRfidAllowedAtPosition(
      latitude,
      longitude,
    );
    const cardsToDelete = allowed
      ? []
      : limitedCards
          .filter((card) => card.installedOnLock)
          .map((card) => card.cardNumber);
    const cardsToAdd = allowed
      ? limitedCards
          .filter((card) => !card.installedOnLock)
          .map((card) => card.cardNumber)
      : [];

    await this.syncPhysicalRfidCards(
      terminalId,
      lockDevice.id,
      cardsToDelete,
      false,
    );
    await this.syncPhysicalRfidCards(
      terminalId,
      lockDevice.id,
      cardsToAdd,
      true,
    );
  }

  private async isLimitedRfidAllowedAtPosition(
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    const geofences = await this.geofencesRepository.find();

    for (const geofence of geofences) {
      const inShape = await this.isPositionInGeofence(
        latitude,
        longitude,
        geofence,
      );
      const accessModeAllows = this.isAccessModeAllowed(
        latitude,
        longitude,
        geofence,
        inShape,
      );
      const activeRuleBlocks =
        inShape &&
        (geofence.rules.lockAccessAllowed === false ||
          geofence.rules.rfidAllowed === false);

      if (!accessModeAllows || activeRuleBlocks) {
        return false;
      }
    }

    return true;
  }

  private async syncPhysicalRfidCards(
    terminalId: string,
    lockDeviceId: string,
    cards: string[],
    install: boolean,
  ): Promise<void> {
    if (cards.length === 0) {
      return;
    }

    const status = install
      ? RfidCardSyncStatus.PendingAdd
      : RfidCardSyncStatus.PendingDelete;

    await this.rfidCardsRepository.update(
      { lockDeviceId, cardNumber: In(cards) },
      {
        lastSyncStatus: status,
        lastSyncError: null,
      },
    );

    for (const chunk of chunks(cards, 20)) {
      try {
        await this.sendRfidCommand(
          terminalId,
          install ? buildRfidAddCommand(chunk) : buildRfidDeleteCommand(chunk),
        );
        await this.rfidCardsRepository.update(
          { lockDeviceId, cardNumber: In(chunk) },
          {
            installedOnLock: install,
            lastSyncStatus: RfidCardSyncStatus.Synced,
            lastSyncError: null,
            lastSyncedAt: new Date(),
          },
        );
      } catch (error) {
        await this.rfidCardsRepository.update(
          { lockDeviceId, cardNumber: In(chunk) },
          {
            lastSyncStatus:
              error instanceof BadRequestException
                ? status
                : RfidCardSyncStatus.Failed,
            lastSyncError:
              error instanceof Error ? error.message : String(error),
          },
        );
        this.logger.warn(
          `Could not ${install ? 'install' : 'remove'} RFID cards for ${terminalId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private alarmTypesFromBinary(parsed: ParsedJt701dBinary): LockEventType[] {
    const status = parsed.status;
    const types: LockEventType[] = [];

    if (status.isRopeCut) types.push(LockEventType.LockRopeCut);
    if (status.isVibrationAlarm) types.push(LockEventType.Vibration);
    if (status.isUnlockLongAlarm) types.push(LockEventType.LongUnlock);
    if (status.isWrongPasswordAlarm) types.push(LockEventType.WrongPassword);
    if (status.isIllegalCardAlarm) types.push(LockEventType.IllegalRfid);
    if (status.isLowBatteryAlarm) types.push(LockEventType.LowBattery);
    if (status.isBackCoverOpenAlarm) types.push(LockEventType.BackCoverOpened);
    if (status.isMotorStuck) types.push(LockEventType.MotorStuck);

    return types.length > 0 ? types : [LockEventType.Other];
  }

  private eventTypeFromP45(
    parsed: Extract<ParsedAsciiFrame, { kind: 'p45_report' }>,
  ): LockEventType {
    if (parsed.eventSourceCode === '5') return LockEventType.Locked;
    if (parsed.eventSourceCode === '2') return LockEventType.IllegalRfid;
    if (parsed.unlockVerification === 'Reject')
      return LockEventType.UnlockRejected;
    return LockEventType.Unlocked;
  }

  private protocolDate(timestamp: string): Date {
    return new Date(timestamp.replace(' UTC', 'Z').replace(' ', 'T'));
  }

  private formatProtocolTime(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${pad(date.getUTCDate())}${pad(date.getUTCMonth() + 1)}${date
      .getUTCFullYear()
      .toString()
      .slice(-2)}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
      date.getUTCSeconds(),
    )}`;
  }

  private pendingKey(terminalId: string, commandWord: string): string {
    return `${terminalId.toUpperCase()}:${commandWord}`;
  }

  private batteryPercentage(value: string): number | null {
    if (!value.endsWith('%')) {
      return null;
    }

    const parsed = Number.parseInt(value.replace('%', ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async isPositionInGeofence(
    latitude: number,
    longitude: number,
    geofence: Geofence,
  ): Promise<boolean> {
    if (!geofence.geoBoundaryId) {
      return isPointInGeofence(latitude, longitude, geofence);
    }

    const rows = await this.dataSource.query<Array<{ inside: boolean }>>(
      `
        SELECT ST_Covers(
          geometry,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)
        ) AS inside
        FROM geo_boundaries
        WHERE id = $3
        LIMIT 1
      `,
      [latitude, longitude, geofence.geoBoundaryId],
    );

    return rows[0]?.inside ?? false;
  }

  private isAccessModeAllowed(
    latitude: number,
    longitude: number,
    geofence: Geofence,
    inShape: boolean,
  ): boolean {
    if (geofence.geoBoundaryId) {
      return geofence.accessMode === GeofenceAccessMode.AllowInside
        ? inShape
        : !inShape;
    }

    return isLockAccessAllowedByGeofence(latitude, longitude, geofence);
  }
}

function sameRules(left: GeofenceRules, right: GeofenceRules): boolean {
  return (
    left.smsAllowed === right.smsAllowed &&
    left.gprsAllowed === right.gprsAllowed &&
    left.rfidAllowed === right.rfidAllowed &&
    left.serialAllowed === right.serialAllowed &&
    left.bluetoothAllowed === right.bluetoothAllowed &&
    left.lockAccessAllowed === right.lockAccessAllowed
  );
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

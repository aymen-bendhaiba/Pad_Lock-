import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Repository } from 'typeorm';
import { LocksService } from '../locks/locks.service';
import {
  buildReportingIntervalsSetCommand,
  buildSimConfigurationQueryCommand,
  buildSimConfigurationSetCommand,
  buildVibrationLevelSetCommand,
} from '../protocol/jt701d-commands';
import { TcpGatewayService } from '../tcp/tcp-gateway.service';
import { UpdateLockConfigurationDto } from './dto/update-lock-configuration.dto';
import {
  LockConfiguration,
  LockConfigurationSyncStatus,
} from './lock-configuration.entity';

type ConfigurationSection = 'reporting' | 'vibration' | 'sim1' | 'sim2';

type SimConfigurationValues = {
  sim: 1 | 2;
  ipAddress: string;
  port: number;
  apn: string;
  apnUser: string;
  apnPassword: string;
};

@Injectable()
export class LockConfigurationsService {
  private readonly encryptionKey: Buffer;
  private readonly retryingLocks = new Set<string>();
  private readonly refreshingLocks = new Map<
    string,
    Promise<LockConfiguration>
  >();

  constructor(
    @InjectRepository(LockConfiguration)
    private readonly configurationsRepository: Repository<LockConfiguration>,
    private readonly locksService: LocksService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TcpGatewayService))
    private readonly tcpGatewayService: TcpGatewayService,
  ) {
    this.encryptionKey = createHash('sha256')
      .update(
        this.configService.getOrThrow<string>('DEVICE_CONFIG_ENCRYPTION_KEY'),
      )
      .digest();
  }

  async findOne(terminalId: string) {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const configuration = await this.configurationsRepository.findOneBy({
      lockDeviceId: lockDevice.id,
    });

    return this.toResponse(lockDevice.terminalId, configuration);
  }

  async refresh(terminalId: string) {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const configuration = await this.configurationsRepository.findOneBy({
      lockDeviceId: lockDevice.id,
    });

    if (!this.tcpGatewayService.isConnected(lockDevice.terminalId)) {
      return this.toResponse(lockDevice.terminalId, configuration);
    }

    const refreshedConfiguration = await this.refreshSimConfigurationFromLock(
      lockDevice.id,
      lockDevice.terminalId,
      configuration,
    );

    return this.toResponse(lockDevice.terminalId, refreshedConfiguration);
  }

  async update(terminalId: string, dto: UpdateLockConfigurationDto) {
    this.assertPatchHasValues(dto);
    this.assertVibrationLevel(dto.vibrationLevelMg);

    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    let configuration = await this.configurationsRepository.findOneBy({
      lockDeviceId: lockDevice.id,
    });

    if (!configuration) {
      configuration = this.createDefaultConfiguration(lockDevice.id);
    }

    const changedSections = new Set<ConfigurationSection>();

    if (
      dto.trackingUploadIntervalSeconds !== undefined &&
      dto.trackingUploadIntervalSeconds !==
        configuration.trackingUploadIntervalSeconds
    ) {
      configuration.trackingUploadIntervalSeconds =
        dto.trackingUploadIntervalSeconds;
      changedSections.add('reporting');
    }

    if (
      dto.wakeUpIntervalMinutes !== undefined &&
      dto.wakeUpIntervalMinutes !== configuration.wakeUpIntervalMinutes
    ) {
      configuration.wakeUpIntervalMinutes = dto.wakeUpIntervalMinutes;
      changedSections.add('reporting');
    }

    if (
      dto.vibrationLevelMg !== undefined &&
      dto.vibrationLevelMg !== configuration.vibrationLevelMg
    ) {
      configuration.vibrationLevelMg = dto.vibrationLevelMg;
      changedSections.add('vibration');
    }

    if (dto.sim1) {
      if (this.applySimPatch(configuration, 1, dto.sim1)) {
        changedSections.add('sim1');
      }
      this.assertSimComplete(configuration, 1);
    }

    if (dto.sim2) {
      if (this.applySimPatch(configuration, 2, dto.sim2)) {
        changedSections.add('sim2');
      }
      this.assertSimComplete(configuration, 2);
    }

    if (changedSections.size === 0) {
      const saved =
        configuration.id === undefined
          ? await this.configurationsRepository.save(configuration)
          : configuration;
      return this.toResponse(lockDevice.terminalId, saved);
    }

    for (const section of changedSections) {
      this.markPending(configuration, section);
    }

    configuration = await this.configurationsRepository.save(configuration);
    await this.syncSections(
      lockDevice.terminalId,
      configuration,
      changedSections,
    );

    return this.toResponse(lockDevice.terminalId, configuration);
  }

  async retryPendingForLock(terminalId: string): Promise<void> {
    const normalizedTerminalId = terminalId.toUpperCase();

    if (this.retryingLocks.has(normalizedTerminalId)) {
      return;
    }

    this.retryingLocks.add(normalizedTerminalId);

    try {
      const lockDevice =
        await this.locksService.findByTerminalIdOrFail(normalizedTerminalId);
      const configuration = await this.configurationsRepository.findOneBy({
        lockDeviceId: lockDevice.id,
      });

      if (!configuration) {
        return;
      }

      const sections = new Set<ConfigurationSection>();

      if (this.needsRetry(configuration.reportingSyncStatus)) {
        sections.add('reporting');
      }
      if (this.needsRetry(configuration.vibrationSyncStatus)) {
        sections.add('vibration');
      }
      if (
        this.needsRetry(configuration.sim2SyncStatus) &&
        this.isSimComplete(configuration, 2)
      ) {
        sections.add('sim2');
      }
      if (
        this.needsRetry(configuration.sim1SyncStatus) &&
        this.isSimComplete(configuration, 1)
      ) {
        sections.add('sim1');
      }

      await this.syncSections(normalizedTerminalId, configuration, sections);
    } finally {
      this.retryingLocks.delete(normalizedTerminalId);
    }
  }

  private async syncSections(
    terminalId: string,
    configuration: LockConfiguration,
    sections: Set<ConfigurationSection>,
  ): Promise<void> {
    if (
      sections.size === 0 ||
      !this.tcpGatewayService.isConnected(terminalId)
    ) {
      return;
    }

    const order: ConfigurationSection[] = [
      'reporting',
      'vibration',
      'sim2',
      'sim1',
    ];

    for (const section of order) {
      if (!sections.has(section)) {
        continue;
      }

      if (!this.tcpGatewayService.isConnected(terminalId)) {
        this.markPending(configuration, section);
        await this.configurationsRepository.save(configuration);
        continue;
      }

      try {
        await this.sendSection(terminalId, configuration, section);
        this.markSynced(configuration, section);
      } catch (error) {
        if (this.tcpGatewayService.isConnected(terminalId)) {
          this.markFailed(configuration, section, error);
        } else {
          this.markPending(configuration, section);
        }
      }

      await this.configurationsRepository.save(configuration);
    }
  }

  private async refreshSimConfigurationFromLock(
    lockDeviceId: string,
    terminalId: string,
    configuration: LockConfiguration | null,
  ): Promise<LockConfiguration> {
    const normalizedTerminalId = terminalId.toUpperCase();
    const inFlight = this.refreshingLocks.get(normalizedTerminalId);

    if (inFlight) {
      return inFlight;
    }

    const refresh = this.doRefreshSimConfigurationFromLock(
      lockDeviceId,
      normalizedTerminalId,
      configuration,
    ).finally(() => {
      this.refreshingLocks.delete(normalizedTerminalId);
    });
    this.refreshingLocks.set(normalizedTerminalId, refresh);

    return refresh;
  }

  private async doRefreshSimConfigurationFromLock(
    lockDeviceId: string,
    terminalId: string,
    configuration: LockConfiguration | null,
  ): Promise<LockConfiguration> {
    let current =
      configuration ?? this.createDefaultConfiguration(lockDeviceId);

    for (const sim of [1, 2] as const) {
      try {
        const values = await this.querySimConfiguration(terminalId, sim);
        this.applyQueriedSimConfiguration(current, sim, values);
        this.markSynced(current, sim === 1 ? 'sim1' : 'sim2');
      } catch (error) {
        if (!this.isCommandBusyError(error)) {
          this.markFailed(current, sim === 1 ? 'sim1' : 'sim2', error);
        }
      }

      current = await this.configurationsRepository.save(current);
    }

    return current;
  }

  private querySimConfiguration(terminalId: string, sim: 1 | 2) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P06',
      buildSimConfigurationQueryCommand(sim),
      (parts) => parseSimConfigurationResponse(parts, sim),
    );
  }

  private applyQueriedSimConfiguration(
    configuration: LockConfiguration,
    sim: 1 | 2,
    values: SimConfigurationValues,
  ): void {
    if (sim === 1) {
      configuration.sim1IpAddress = values.ipAddress;
      configuration.sim1Port = values.port;
      configuration.sim1Apn = values.apn;
      configuration.sim1ApnUser = values.apnUser;
      configuration.sim1ApnPasswordEncrypted = values.apnPassword
        ? this.encrypt(values.apnPassword)
        : null;
      return;
    }

    configuration.sim2IpAddress = values.ipAddress;
    configuration.sim2Port = values.port;
    configuration.sim2Apn = values.apn;
    configuration.sim2ApnUser = values.apnUser;
    configuration.sim2ApnPasswordEncrypted = values.apnPassword
      ? this.encrypt(values.apnPassword)
      : null;
  }

  private sendSection(
    terminalId: string,
    configuration: LockConfiguration,
    section: ConfigurationSection,
  ): Promise<unknown> {
    if (section === 'reporting') {
      return this.tcpGatewayService.sendCommand(
        terminalId,
        'P04',
        buildReportingIntervalsSetCommand(
          configuration.trackingUploadIntervalSeconds,
          configuration.wakeUpIntervalMinutes,
        ),
        (parts) => ({
          success: true,
          trackingUploadIntervalSeconds: Number.parseInt(parts[2] ?? '0', 10),
          wakeUpIntervalMinutes: Number.parseInt(parts[3] ?? '0', 10),
        }),
      );
    }

    if (section === 'vibration') {
      return this.tcpGatewayService.sendCommand(
        terminalId,
        'P37',
        buildVibrationLevelSetCommand(configuration.vibrationLevelMg),
        (parts) => ({
          success: true,
          vibrationLevelMg: Number.parseInt(parts[2] ?? '0', 10),
        }),
      );
    }

    const sim = section === 'sim1' ? 1 : 2;
    const values = this.simValues(configuration, sim);

    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P06',
      buildSimConfigurationSetCommand(sim, values),
      (parts) => ({
        success: true,
        ipAddress: parts[2] ?? '',
        port: Number.parseInt(parts[3] ?? '0', 10),
        sim,
      }),
    );
  }

  private applySimPatch(
    configuration: LockConfiguration,
    sim: 1 | 2,
    patch: NonNullable<UpdateLockConfigurationDto['sim1']>,
  ): boolean {
    if (sim === 1) {
      return this.applySim1Patch(configuration, patch);
    }

    return this.applySim2Patch(configuration, patch);
  }

  private applySim1Patch(
    configuration: LockConfiguration,
    patch: NonNullable<UpdateLockConfigurationDto['sim1']>,
  ): boolean {
    let changed = false;

    if (
      patch.ipAddress !== undefined &&
      patch.ipAddress !== configuration.sim1IpAddress
    ) {
      configuration.sim1IpAddress = patch.ipAddress;
      changed = true;
    }
    if (patch.port !== undefined && patch.port !== configuration.sim1Port) {
      configuration.sim1Port = patch.port;
      changed = true;
    }
    if (patch.apn !== undefined && patch.apn !== configuration.sim1Apn) {
      configuration.sim1Apn = patch.apn;
      changed = true;
    }
    if (
      patch.apnUser !== undefined &&
      patch.apnUser !== (configuration.sim1ApnUser ?? '')
    ) {
      configuration.sim1ApnUser = patch.apnUser;
      changed = true;
    }
    if (
      patch.apnPassword !== undefined &&
      patch.apnPassword !== this.decrypt(configuration.sim1ApnPasswordEncrypted)
    ) {
      configuration.sim1ApnPasswordEncrypted = patch.apnPassword
        ? this.encrypt(patch.apnPassword)
        : null;
      changed = true;
    }

    return changed;
  }

  private applySim2Patch(
    configuration: LockConfiguration,
    patch: NonNullable<UpdateLockConfigurationDto['sim2']>,
  ): boolean {
    let changed = false;

    if (
      patch.ipAddress !== undefined &&
      patch.ipAddress !== configuration.sim2IpAddress
    ) {
      configuration.sim2IpAddress = patch.ipAddress;
      changed = true;
    }
    if (patch.port !== undefined && patch.port !== configuration.sim2Port) {
      configuration.sim2Port = patch.port;
      changed = true;
    }
    if (patch.apn !== undefined && patch.apn !== configuration.sim2Apn) {
      configuration.sim2Apn = patch.apn;
      changed = true;
    }
    if (
      patch.apnUser !== undefined &&
      patch.apnUser !== (configuration.sim2ApnUser ?? '')
    ) {
      configuration.sim2ApnUser = patch.apnUser;
      changed = true;
    }
    if (
      patch.apnPassword !== undefined &&
      patch.apnPassword !== this.decrypt(configuration.sim2ApnPasswordEncrypted)
    ) {
      configuration.sim2ApnPasswordEncrypted = patch.apnPassword
        ? this.encrypt(patch.apnPassword)
        : null;
      changed = true;
    }

    return changed;
  }

  private simValues(configuration: LockConfiguration, sim: 1 | 2) {
    if (sim === 1) {
      return {
        ipAddress: configuration.sim1IpAddress as string,
        port: configuration.sim1Port as number,
        apn: configuration.sim1Apn as string,
        apnUser: configuration.sim1ApnUser ?? '',
        apnPassword: this.decrypt(configuration.sim1ApnPasswordEncrypted),
      };
    }

    return {
      ipAddress: configuration.sim2IpAddress as string,
      port: configuration.sim2Port as number,
      apn: configuration.sim2Apn as string,
      apnUser: configuration.sim2ApnUser ?? '',
      apnPassword: this.decrypt(configuration.sim2ApnPasswordEncrypted),
    };
  }

  private assertSimComplete(
    configuration: LockConfiguration,
    sim: 1 | 2,
  ): void {
    if (!this.isSimComplete(configuration, sim)) {
      throw new BadRequestException(
        `SIM${sim} configuration requires ipAddress, port, and apn`,
      );
    }
  }

  private isSimComplete(configuration: LockConfiguration, sim: 1 | 2): boolean {
    return sim === 1
      ? Boolean(
          configuration.sim1IpAddress &&
          configuration.sim1Port &&
          configuration.sim1Apn,
        )
      : Boolean(
          configuration.sim2IpAddress &&
          configuration.sim2Port &&
          configuration.sim2Apn,
        );
  }

  private assertPatchHasValues(dto: UpdateLockConfigurationDto): void {
    const hasValues =
      dto.trackingUploadIntervalSeconds !== undefined ||
      dto.wakeUpIntervalMinutes !== undefined ||
      dto.vibrationLevelMg !== undefined ||
      (dto.sim1 !== undefined && Object.keys(dto.sim1).length > 0) ||
      (dto.sim2 !== undefined && Object.keys(dto.sim2).length > 0);

    if (!hasValues) {
      throw new BadRequestException(
        'At least one lock configuration field is required',
      );
    }
  }

  private assertVibrationLevel(level: number | undefined): void {
    if (level !== undefined && level !== 0 && level < 63) {
      throw new BadRequestException(
        'vibrationLevelMg must be 0 or between 63 and 500',
      );
    }
  }

  private needsRetry(status: LockConfigurationSyncStatus | null): boolean {
    return (
      status === LockConfigurationSyncStatus.Pending ||
      status === LockConfigurationSyncStatus.Failed
    );
  }

  private isCommandBusyError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes('command is already waiting for a response')
    );
  }

  private markPending(
    configuration: LockConfiguration,
    section: ConfigurationSection,
  ): void {
    this.setSyncState(
      configuration,
      section,
      LockConfigurationSyncStatus.Pending,
      null,
      undefined,
    );
  }

  private markSynced(
    configuration: LockConfiguration,
    section: ConfigurationSection,
  ): void {
    this.setSyncState(
      configuration,
      section,
      LockConfigurationSyncStatus.Synced,
      null,
      new Date(),
    );
  }

  private markFailed(
    configuration: LockConfiguration,
    section: ConfigurationSection,
    error: unknown,
  ): void {
    const message =
      error instanceof Error ? error.message : 'Unknown synchronization error';
    this.setSyncState(
      configuration,
      section,
      LockConfigurationSyncStatus.Failed,
      message.slice(0, 1000),
      undefined,
    );
  }

  private setSyncState(
    configuration: LockConfiguration,
    section: ConfigurationSection,
    status: LockConfigurationSyncStatus,
    error: string | null,
    syncedAt: Date | null | undefined,
  ): void {
    if (section === 'sim1') {
      configuration.sim1SyncStatus = status;
      configuration.sim1SyncError = error;
      if (syncedAt !== undefined) {
        configuration.sim1SyncedAt = syncedAt;
      }
    } else if (section === 'sim2') {
      configuration.sim2SyncStatus = status;
      configuration.sim2SyncError = error;
      if (syncedAt !== undefined) {
        configuration.sim2SyncedAt = syncedAt;
      }
    } else if (section === 'reporting') {
      configuration.reportingSyncStatus = status;
      configuration.reportingSyncError = error;
      if (syncedAt !== undefined) {
        configuration.reportingSyncedAt = syncedAt;
      }
    } else {
      configuration.vibrationSyncStatus = status;
      configuration.vibrationSyncError = error;
      if (syncedAt !== undefined) {
        configuration.vibrationSyncedAt = syncedAt;
      }
    }
  }

  private createDefaultConfiguration(lockDeviceId: string): LockConfiguration {
    return this.configurationsRepository.create({
      lockDeviceId,
      sim1IpAddress: null,
      sim1Port: null,
      sim1Apn: null,
      sim1ApnUser: null,
      sim1ApnPasswordEncrypted: null,
      sim2IpAddress: null,
      sim2Port: null,
      sim2Apn: null,
      sim2ApnUser: null,
      sim2ApnPasswordEncrypted: null,
      trackingUploadIntervalSeconds: 30,
      wakeUpIntervalMinutes: 30,
      vibrationLevelMg: 126,
      sim1SyncStatus: null,
      sim1SyncError: null,
      sim1SyncedAt: null,
      sim2SyncStatus: null,
      sim2SyncError: null,
      sim2SyncedAt: null,
      reportingSyncStatus: null,
      reportingSyncError: null,
      reportingSyncedAt: null,
      vibrationSyncStatus: null,
      vibrationSyncError: null,
      vibrationSyncedAt: null,
    });
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, ciphertext]
      .map((part) => part.toString('base64url'))
      .join('.');
  }

  private decrypt(value: string | null): string {
    if (!value) {
      return '';
    }

    const [ivValue, authTagValue, ciphertextValue] = value.split('.');

    if (!ivValue || !authTagValue || ciphertextValue === undefined) {
      throw new Error('Stored APN password is not in the expected format');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private toResponse(
    terminalId: string,
    configuration: LockConfiguration | null,
  ) {
    if (!configuration) {
      return {
        terminalId,
        configured: false,
        sim1: null,
        sim2: null,
        trackingUploadIntervalSeconds: null,
        wakeUpIntervalMinutes: null,
        vibrationLevelMg: null,
        sync: {
          sim1: null,
          sim2: null,
          reporting: null,
          vibration: null,
        },
      };
    }

    return {
      terminalId,
      configured: true,
      sim1: this.simResponse(configuration, 1),
      sim2: this.simResponse(configuration, 2),
      trackingUploadIntervalSeconds:
        configuration.trackingUploadIntervalSeconds,
      wakeUpIntervalMinutes: configuration.wakeUpIntervalMinutes,
      vibrationLevelMg: configuration.vibrationLevelMg,
      sync: {
        sim1: this.syncResponse(
          configuration.sim1SyncStatus,
          configuration.sim1SyncError,
          configuration.sim1SyncedAt,
        ),
        sim2: this.syncResponse(
          configuration.sim2SyncStatus,
          configuration.sim2SyncError,
          configuration.sim2SyncedAt,
        ),
        reporting: this.syncResponse(
          configuration.reportingSyncStatus,
          configuration.reportingSyncError,
          configuration.reportingSyncedAt,
        ),
        vibration: this.syncResponse(
          configuration.vibrationSyncStatus,
          configuration.vibrationSyncError,
          configuration.vibrationSyncedAt,
        ),
      },
      createdAt: configuration.createdAt,
      updatedAt: configuration.updatedAt,
    };
  }

  private simResponse(configuration: LockConfiguration, sim: 1 | 2) {
    const values =
      sim === 1
        ? {
            ipAddress: configuration.sim1IpAddress,
            port: configuration.sim1Port,
            apn: configuration.sim1Apn,
            apnUser: configuration.sim1ApnUser ?? '',
            encryptedPassword: configuration.sim1ApnPasswordEncrypted,
          }
        : {
            ipAddress: configuration.sim2IpAddress,
            port: configuration.sim2Port,
            apn: configuration.sim2Apn,
            apnUser: configuration.sim2ApnUser ?? '',
            encryptedPassword: configuration.sim2ApnPasswordEncrypted,
          };

    if (!values.ipAddress && !values.port && !values.apn) {
      return null;
    }

    return {
      ipAddress: values.ipAddress,
      port: values.port,
      apn: values.apn,
      apnUser: values.apnUser,
      apnPasswordConfigured: Boolean(values.encryptedPassword),
    };
  }

  private syncResponse(
    status: LockConfigurationSyncStatus | null,
    error: string | null,
    syncedAt: Date | null,
  ) {
    if (!status) {
      return null;
    }

    return { status, error, syncedAt };
  }
}

function parseSimConfigurationResponse(
  parts: string[],
  expectedSim: 1 | 2,
): SimConfigurationValues {
  const valueOffset = ['0', '2'].includes(parts[2] ?? '') ? 3 : 2;

  return {
    sim: expectedSim,
    ipAddress: parts[valueOffset] ?? '',
    port: Number.parseInt(parts[valueOffset + 1] ?? '0', 10),
    apn: parts[valueOffset + 2] ?? '',
    apnUser: parts[valueOffset + 3] ?? '',
    apnPassword: parts[valueOffset + 4] ?? '',
  };
}

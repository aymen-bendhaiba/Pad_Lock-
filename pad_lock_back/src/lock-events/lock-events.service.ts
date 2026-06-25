import {
  BadRequestException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { interval, map, merge, Observable, Subject, filter } from 'rxjs';
import { Repository } from 'typeorm';
import { LocksService } from '../locks/locks.service';
import { CreateLockEventDto } from './dto/create-lock-event.dto';
import { FindAlertsQueryDto } from './dto/find-alerts-query.dto';
import { UpdateAlertStatusDto } from './dto/update-alert-status.dto';
import {
  LockEvent,
  LockEventSeverity,
  LockEventStatus,
  LockEventType,
} from './lock-event.entity';

@Injectable()
export class LockEventsService {
  private readonly alertSubject = new Subject<LockEvent>();

  constructor(
    @InjectRepository(LockEvent)
    private readonly lockEventsRepository: Repository<LockEvent>,
    private readonly locksService: LocksService,
  ) {}

  async create(
    terminalId: string,
    dto: CreateLockEventDto,
  ): Promise<LockEvent> {
    const lockDevice = await this.locksService.findOrCreateFromTcp(terminalId);

    const event = await this.lockEventsRepository.save(
      this.lockEventsRepository.create({
        lockDeviceId: lockDevice.id,
        terminalId: lockDevice.terminalId,
        type: dto.type,
        severity: dto.severity ?? severityForType(dto.type),
        status: LockEventStatus.Unread,
        source: dto.source ?? null,
        rfidCardNumber: dto.rfidCardNumber ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        rawPayload: dto.rawPayload ?? null,
        geofences: [],
        occurredAt: new Date(dto.occurredAt),
      }),
    );

    this.emitAlert(event);

    return event;
  }

  async findLatest(query: FindAlertsQueryDto = {}): Promise<LockEvent[]> {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    if (from && to && from > to) {
      throw new BadRequestException('Alert from date must be before to date');
    }

    const builder = this.lockEventsRepository
      .createQueryBuilder('event')
      .select([
        'event.id',
        'event.lockDeviceId',
        'event.terminalId',
        'event.type',
        'event.severity',
        'event.status',
        'event.source',
        'event.rfidCardNumber',
        'event.latitude',
        'event.longitude',
        'event.geofences',
        'event.occurredAt',
        'event.receivedAt',
      ])
      .where('event.deletedAt IS NULL')
      .orderBy('event.occurredAt', 'DESC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 100))
      .take(query.limit ?? 100);

    if (query.terminalId) {
      builder.andWhere('event."terminalId" = :terminalId', {
        terminalId: query.terminalId.toUpperCase(),
      });
    }
    if (query.status) {
      builder.andWhere('event.status = :status', { status: query.status });
    }
    if (query.type) {
      builder.andWhere('event.type = :type', { type: query.type });
    }
    if (query.severity) {
      builder.andWhere('event.severity = :severity', {
        severity: query.severity,
      });
    }
    if (from) {
      builder.andWhere('event."occurredAt" >= :from', { from });
    }
    if (to) {
      builder.andWhere('event."occurredAt" <= :to', { to });
    }

    return builder.getMany();
  }

  async recordFromTcp(
    terminalId: string,
    input: {
      type: LockEventType;
      source?: string | null;
      rfidCardNumber?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      rawPayload?: Record<string, unknown>;
      geofences?: Array<{ id: string; name: string }>;
      occurredAt: Date;
    },
  ): Promise<LockEvent> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);

    const event = await this.lockEventsRepository.save(
      this.lockEventsRepository.create({
        lockDeviceId: lockDevice.id,
        terminalId: lockDevice.terminalId,
        type: input.type,
        severity: severityForType(input.type),
        status: LockEventStatus.Unread,
        source: input.source ?? null,
        rfidCardNumber: input.rfidCardNumber ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        rawPayload: input.rawPayload ?? null,
        geofences: input.geofences ?? [],
        occurredAt: input.occurredAt,
      }),
    );

    this.emitAlert(event);

    return event;
  }

  async updateStatus(
    id: string,
    dto: UpdateAlertStatusDto,
  ): Promise<LockEvent> {
    const event = await this.lockEventsRepository.findOneBy({ id });

    if (!event) {
      throw new NotFoundException('Alert not found');
    }

    event.status = dto.status;

    return this.lockEventsRepository.save(event);
  }

  streamAlerts(terminalId?: string): Observable<MessageEvent> {
    const normalizedTerminalId = terminalId?.toUpperCase();
    const alerts = this.alertSubject.asObservable().pipe(
      filter(
        (event) =>
          !normalizedTerminalId || event.terminalId === normalizedTerminalId,
      ),
      map((event) => ({
        type: 'alert',
        data: event,
      })),
    );
    const keepalive = interval(25000).pipe(
      map(() => ({
        type: 'keepalive',
        data: { timestamp: new Date().toISOString() },
      })),
    );

    return merge(alerts, keepalive);
  }

  private emitAlert(event: LockEvent): void {
    this.alertSubject.next(event);
  }
}

function severityForType(type: LockEventType): LockEventSeverity {
  if (
    [
      LockEventType.LockRopeCut,
      LockEventType.IllegalRfid,
      LockEventType.WrongPassword,
      LockEventType.MotorStuck,
    ].includes(type)
  ) {
    return LockEventSeverity.Critical;
  }

  if (
    [
      LockEventType.LowBattery,
      LockEventType.LongUnlock,
      LockEventType.BackCoverOpened,
      LockEventType.Vibration,
      LockEventType.UnlockRejected,
    ].includes(type)
  ) {
    return LockEventSeverity.Warning;
  }

  return LockEventSeverity.Info;
}

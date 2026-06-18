import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocksService } from '../locks/locks.service';
import { CreateLockEventDto } from './dto/create-lock-event.dto';
import {
  LockEvent,
  LockEventSeverity,
  LockEventType,
} from './lock-event.entity';

@Injectable()
export class LockEventsService {
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

    return this.lockEventsRepository.save(
      this.lockEventsRepository.create({
        lockDeviceId: lockDevice.id,
        terminalId: lockDevice.terminalId,
        type: dto.type,
        severity: dto.severity ?? severityForType(dto.type),
        source: dto.source ?? null,
        rfidCardNumber: dto.rfidCardNumber ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        rawPayload: dto.rawPayload ?? null,
        occurredAt: new Date(dto.occurredAt),
      }),
    );
  }

  async findLatest(terminalId?: string): Promise<LockEvent[]> {
    const where = terminalId ? { terminalId: terminalId.toUpperCase() } : {};

    return this.lockEventsRepository.find({
      where,
      order: { occurredAt: 'DESC' },
      take: 100,
    });
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
      occurredAt: Date;
    },
  ): Promise<LockEvent> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);

    return this.lockEventsRepository.save(
      this.lockEventsRepository.create({
        lockDeviceId: lockDevice.id,
        terminalId: lockDevice.terminalId,
        type: input.type,
        severity: severityForType(input.type),
        source: input.source ?? null,
        rfidCardNumber: input.rfidCardNumber ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        rawPayload: input.rawPayload ?? null,
        occurredAt: input.occurredAt,
      }),
    );
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

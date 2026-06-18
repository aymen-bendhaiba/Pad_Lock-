import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { LocksService } from '../locks/locks.service';
import { LockPosition } from './lock-position.entity';

type RecordPositionInput = {
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  directionDegrees?: number | null;
  batteryPercentage?: number | null;
  isCharging?: boolean;
  isLocked?: boolean | null;
  rawPayload?: Record<string, unknown>;
  recordedAt: Date;
};

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(LockPosition)
    private readonly positionsRepository: Repository<LockPosition>,
    private readonly locksService: LocksService,
  ) {}

  async recordFromTcp(
    terminalId: string,
    input: RecordPositionInput,
  ): Promise<LockPosition> {
    const lockDevice = await this.locksService.findOrCreateFromTcp(terminalId, {
      imei:
        typeof input.rawPayload?.imei === 'string'
          ? input.rawPayload.imei
          : null,
    });

    return this.positionsRepository.save(
      this.positionsRepository.create({
        lockDeviceId: lockDevice.id,
        terminalId: lockDevice.terminalId,
        latitude: input.latitude,
        longitude: input.longitude,
        speedKmh: input.speedKmh ?? null,
        directionDegrees: input.directionDegrees ?? null,
        batteryPercentage: input.batteryPercentage ?? null,
        isCharging: input.isCharging ?? false,
        isLocked: input.isLocked ?? null,
        rawPayload: input.rawPayload ?? null,
        recordedAt: input.recordedAt,
      }),
    );
  }

  async findActiveDevices() {
    const positions = await this.positionsRepository.find({
      order: { recordedAt: 'DESC' },
      take: 1000,
    });
    const latestByTerminal = new Map<string, LockPosition>();

    for (const position of positions) {
      if (!latestByTerminal.has(position.terminalId)) {
        latestByTerminal.set(position.terminalId, position);
      }
    }

    return [...latestByTerminal.values()].map((position) => ({
      id: position.terminalId,
      position: {
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speedKmh ?? 0,
        timestamp: position.receivedAt.getTime(),
        gpsTimestamp: position.recordedAt.getTime(),
        battery:
          position.batteryPercentage === null
            ? null
            : `${position.batteryPercentage}%`,
        isCharging: position.isCharging,
        isLocked: position.isLocked,
      },
    }));
  }

  async findTodayHistory(terminalId: string): Promise<number[][]> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const positions = await this.positionsRepository.find({
      where: {
        terminalId: terminalId.toUpperCase(),
        recordedAt: MoreThanOrEqual(startOfToday),
      },
      order: { recordedAt: 'ASC' },
    });

    return positions.map((position) => [position.latitude, position.longitude]);
  }
}

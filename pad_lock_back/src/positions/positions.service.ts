import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { LocksService } from '../locks/locks.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { LockPosition } from './lock-position.entity';

type RecordPositionInput = {
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  directionDegrees?: number | null;
  batteryPercentage?: number | null;
  isCharging?: boolean;
  isLocked?: boolean | null;
  isPositioned?: boolean;
  mileage?: number | null;
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
        isPositioned: input.isPositioned ?? true,
        mileage: input.mileage ?? null,
        rawPayload: input.rawPayload ?? null,
        recordedAt: input.recordedAt,
      }),
    );
  }

  async findActiveDevices() {
    const positions = await this.positionsRepository
      .createQueryBuilder('position')
      .distinctOn(['position.terminalId'])
      .orderBy('position.terminalId', 'ASC')
      .addOrderBy('position.recordedAt', 'DESC')
      .limit(1000)
      .getMany();

    return positions.map((position) => ({
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
        is_positioned: position.isPositioned,
        mileage: position.mileage,
      },
    }));
  }

  async findHistory(
    terminalId: string,
    query: HistoryQueryDto = {},
  ): Promise<number[][]> {
    const from = query.from ? new Date(query.from) : startOfUtcToday();
    const to = query.to ? new Date(query.to) : null;

    if (to && from > to) {
      throw new BadRequestException('History from date must be before to date');
    }

    const positions = await this.positionsRepository.find({
      where: {
        terminalId: terminalId.toUpperCase(),
        recordedAt: to ? Between(from, to) : MoreThanOrEqual(from),
      },
      order: { recordedAt: 'ASC' },
    });

    return positions.map((position) => [position.latitude, position.longitude]);
  }

  findLatestForLock(terminalId: string): Promise<LockPosition | null> {
    return this.positionsRepository.findOne({
      where: { terminalId: terminalId.toUpperCase() },
      order: { recordedAt: 'DESC' },
    });
  }
}

function startOfUtcToday(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LockDeviceStatus } from '../locks/lock-device.entity';
import { LocksService } from '../locks/locks.service';
import { TcpConnectionsService } from '../tcp/tcp-connections.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { FindDevicesQueryDto } from './dto/find-devices-query.dto';
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
    private readonly tcpConnectionsService: TcpConnectionsService,
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

  async findActiveDevices(query: FindDevicesQueryDto = {}) {
    await this.locksService.syncStatusesWithCurrentConnections();

    const builder = this.positionsRepository
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.lockDevice', 'lockDevice')
      .distinctOn(['position.terminalId'])
      .select([
        'position.terminalId',
        'position.latitude',
        'position.longitude',
        'position.speedKmh',
        'position.batteryPercentage',
        'position.isCharging',
        'position.isLocked',
        'position.isPositioned',
        'position.mileage',
        'position.recordedAt',
        'position.receivedAt',
        'lockDevice.id',
        'lockDevice.name',
        'lockDevice.imei',
        'lockDevice.status',
        'lockDevice.lastSeenAt',
      ])
      .where('position.deletedAt IS NULL')
      .orderBy('position.terminalId', 'ASC')
      .addOrderBy('position.recordedAt', 'DESC')
      .limit(query.limit ?? 500);

    if (query.search?.trim()) {
      builder.andWhere('position."terminalId" ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.isPositioned !== undefined) {
      builder.andWhere('position."isPositioned" = :isPositioned', {
        isPositioned: query.isPositioned,
      });
    }

    const positions = await builder.getMany();

    return positions.map((position) => {
      const isConnected = this.tcpConnectionsService.has(position.terminalId);
      const status = isConnected
        ? LockDeviceStatus.Online
        : LockDeviceStatus.Offline;
      const telemetryAvailable = isConnected;

      return {
        id: position.terminalId,
        terminalId: position.terminalId,
        name: position.lockDevice?.name,
        imei: position.lockDevice?.imei,
        status,
        online: telemetryAvailable,
        connected: telemetryAvailable,
        telemetryAvailable,
        connectionStatus: telemetryAvailable
          ? 'connected'
          : 'not_connected_over_tcp',
        lastSeenAt: position.lockDevice?.lastSeenAt?.toISOString() ?? null,
        position: {
          lat: position.latitude,
          lng: position.longitude,
          speed: telemetryAvailable ? (position.speedKmh ?? 0) : null,
          timestamp: position.receivedAt.getTime(),
          gpsTimestamp: position.recordedAt.getTime(),
          lastKnownAt: position.recordedAt.toISOString(),
          battery:
            telemetryAvailable && position.batteryPercentage !== null
              ? `${position.batteryPercentage}%`
              : null,
          isCharging: telemetryAvailable ? position.isCharging : null,
          isLocked: telemetryAvailable ? position.isLocked : null,
          is_positioned: position.isPositioned,
          mileage: telemetryAvailable ? position.mileage : null,
          telemetryAvailable,
          connectionStatus: telemetryAvailable
            ? 'connected'
            : 'not_connected_over_tcp',
        },
      };
    });
  }

  async findHistory(
    terminalId: string,
    query: HistoryQueryDto = {},
  ): Promise<number[][]> {
    const from = query.from ? new Date(query.from) : startOfUtcToday();
    const to = query.to ? new Date(query.to) : new Date();
    const maxPoints = query.maxPoints ?? 2000;

    if (from > to) {
      throw new BadRequestException('History from date must be before to date');
    }

    const normalizedTerminalId = terminalId.toUpperCase();
    const [countRow] = await this.positionsRepository.query<
      Array<{ total: string }>
    >(
      `
        SELECT COUNT(*)::text AS total
        FROM lock_positions
        WHERE "terminalId" = $1
          AND "recordedAt" >= $2
          AND "recordedAt" <= $3
          AND "deletedAt" IS NULL
          AND "isPositioned" = true
      `,
      [normalizedTerminalId, from, to],
    );
    const total = Number.parseInt(countRow?.total ?? '0', 10);

    if (total === 0) {
      return [];
    }

    const sampleStep =
      total <= maxPoints
        ? 1
        : Math.ceil((total - 1) / Math.max(1, maxPoints - 1));
    const positions = await this.positionsRepository.query<
      Array<{ latitude: number; longitude: number }>
    >(
      `
        WITH ordered_positions AS (
          SELECT
            latitude,
            longitude,
            ROW_NUMBER() OVER (ORDER BY "recordedAt" ASC) AS row_number
          FROM lock_positions
          WHERE "terminalId" = $1
            AND "recordedAt" >= $2
            AND "recordedAt" <= $3
            AND "deletedAt" IS NULL
            AND "isPositioned" = true
        )
        SELECT latitude, longitude
        FROM ordered_positions
        WHERE MOD(row_number - 1, $4) = 0
           OR row_number = $5
        ORDER BY row_number ASC
      `,
      [normalizedTerminalId, from, to, sampleStep, total],
    );

    return positions.map((position) => [
      Number(position.latitude),
      Number(position.longitude),
    ]);
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

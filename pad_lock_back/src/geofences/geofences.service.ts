import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, In, Repository } from 'typeorm';
import { GeoBoundariesService } from '../geo-boundaries/geo-boundaries.service';
import { LockDevice } from '../locks/lock-device.entity';
import { PositionsService } from '../positions/positions.service';
import {
  buildUnlockChannelsQueryCommand,
  buildUnlockChannelsSetCommand,
} from '../protocol/jt701d-commands';
import { RfidCard, RfidCardRole } from '../rfid/rfid-card.entity';
import { TcpGatewayService } from '../tcp/tcp-gateway.service';
import { CheckCardAccessDto } from './dto/check-card-access.dto';
import { CreateGeofenceFromBoundaryDto } from './dto/create-geofence-from-boundary.dto';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { FindGeofencesQueryDto } from './dto/find-geofences-query.dto';
import { UnlockChannelsDto } from './dto/unlock-channels.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import {
  Geofence,
  GeofenceAccessMode,
  GeofenceShapeType,
} from './geofence.entity';
import {
  geofenceBlocksLimitedRfidAccess,
  isLimitedRfidAllowedByGeofences,
  isLockAccessAllowedByGeofence,
  isPointInGeofence,
  normalizeGeofenceRules,
} from './geofence-geometry';

@Injectable()
export class GeofencesService {
  private readonly logger = new Logger(GeofencesService.name);

  constructor(
    @InjectRepository(Geofence)
    private readonly geofencesRepository: Repository<Geofence>,
    @InjectRepository(RfidCard)
    private readonly rfidCardsRepository: Repository<RfidCard>,
    @InjectRepository(LockDevice)
    private readonly locksRepository: Repository<LockDevice>,
    private readonly geoBoundariesService: GeoBoundariesService,
    private readonly tcpGatewayService: TcpGatewayService,
    private readonly positionsService: PositionsService,
  ) {}

  findAll(query: FindGeofencesQueryDto = {}): Promise<Geofence[]> {
    const builder = this.geofencesRepository
      .createQueryBuilder('geofence')
      .orderBy('geofence.createdAt', 'DESC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 100))
      .take(query.limit ?? 100);

    if (query.terminalId?.trim()) {
      builder.andWhere('geofence."terminalIds" @> ARRAY[:terminalId]::text[]', {
        terminalId: query.terminalId.trim().toUpperCase(),
      });
    }
    if (query.shapeType) {
      builder.andWhere('geofence."shapeType" = :shapeType', {
        shapeType: query.shapeType,
      });
    }
    if (query.accessMode) {
      builder.andWhere('geofence."accessMode" = :accessMode', {
        accessMode: query.accessMode,
      });
    }
    if (query.assigned !== undefined) {
      builder.andWhere(
        query.assigned
          ? 'cardinality(geofence."terminalIds") > 0'
          : 'cardinality(geofence."terminalIds") = 0',
      );
    }
    if (query.search?.trim()) {
      builder.andWhere('geofence.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    return builder.getMany();
  }

  async create(dto: CreateGeofenceDto) {
    this.assertGeofenceShape(dto);
    const terminalIds = dto.terminalIds
      ? await this.validateTerminalIds(dto.terminalIds)
      : [];
    const geofence = await this.geofencesRepository.save(
      this.geofencesRepository.create({
        ...dto,
        terminalIds,
        radiusMeters: dto.radiusMeters ?? null,
        applyInside:
          dto.applyInside ?? dto.accessMode === GeofenceAccessMode.AllowInside,
        rules: normalizeGeofenceRules(dto.rules),
      }),
    );
    await this.applyCurrentRulesForLocks(geofence.terminalIds);

    return { success: true, id: geofence.id };
  }

  async createFromBoundary(dto: CreateGeofenceFromBoundaryDto) {
    await this.geoBoundariesService.findOne(dto.geoBoundaryId);
    const terminalIds = dto.terminalIds
      ? await this.validateTerminalIds(dto.terminalIds)
      : [];

    const geofence = await this.geofencesRepository.save(
      this.geofencesRepository.create({
        name: dto.name,
        terminalIds,
        geoBoundaryId: dto.geoBoundaryId,
        shapeType: GeofenceShapeType.Polygon,
        coordinates: [],
        radiusMeters: null,
        applyInside: dto.accessMode === GeofenceAccessMode.AllowInside,
        accessMode: dto.accessMode,
        rules: normalizeGeofenceRules(dto.rules),
      }),
    );
    await this.applyCurrentRulesForLocks(geofence.terminalIds);

    return { success: true, id: geofence.id };
  }

  async update(id: string, dto: UpdateGeofenceDto): Promise<Geofence> {
    if (!hasUpdateValues(dto)) {
      throw new BadRequestException('At least one geofence field is required');
    }

    const geofence = await this.geofencesRepository.findOneBy({ id });

    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }

    const previousTerminalIds = [...geofence.terminalIds];

    if (dto.name !== undefined) {
      geofence.name = dto.name;
    }
    if (dto.terminalIds !== undefined) {
      geofence.terminalIds = await this.validateTerminalIds(dto.terminalIds);
    }
    if (dto.shapeType !== undefined) {
      geofence.shapeType = dto.shapeType;
    }
    if (dto.coordinates !== undefined) {
      geofence.coordinates = dto.coordinates;
    }
    if (dto.radiusMeters !== undefined) {
      geofence.radiusMeters = dto.radiusMeters;
    }
    if (dto.accessMode !== undefined) {
      geofence.accessMode = dto.accessMode;
      geofence.applyInside = dto.accessMode === GeofenceAccessMode.AllowInside;
    }
    if (dto.rules !== undefined) {
      geofence.rules = {
        ...normalizeGeofenceRules(geofence.rules),
        ...dto.rules,
      };
    }

    this.assertGeofenceShape(geofence);

    const updated = await this.geofencesRepository.save(geofence);
    await this.applyCurrentRulesForLocks([
      ...previousTerminalIds,
      ...updated.terminalIds,
    ]);

    return updated;
  }

  async delete(id: string) {
    const geofence = await this.geofencesRepository.findOneBy({ id });

    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }

    const result = await this.geofencesRepository.delete({ id });

    if (!result.affected) {
      throw new NotFoundException('Geofence not found');
    }

    await this.applyCurrentRulesForLocks(geofence.terminalIds);

    return { success: true, message: 'Geofence deleted successfully.' };
  }

  queryUnlockChannels(terminalId: string) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P59',
      buildUnlockChannelsQueryCommand(),
      parseP59Response,
    );
  }

  setUnlockChannels(terminalId: string, dto: UnlockChannelsDto) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P59',
      buildUnlockChannelsSetCommand(dto),
      parseP59Response,
    );
  }

  async checkCardAccess(terminalId: string, dto: CheckCardAccessDto) {
    const card = await this.rfidCardsRepository.findOne({
      where: {
        cardNumber: dto.cardNumber,
        lockDevice: { terminalId: terminalId.toUpperCase() },
        active: true,
      },
      relations: { lockDevice: true },
    });

    if (!card) {
      return {
        allowed: false,
        reason: 'card_not_registered',
        cardRole: null,
        activeGeofences: [],
      };
    }

    if (card.role === RfidCardRole.Admin) {
      return {
        allowed: true,
        reason: 'admin_card_bypass',
        cardRole: card.role,
        activeGeofences: [],
      };
    }

    const latestPosition =
      await this.positionsService.findLatestForLock(terminalId);

    if (!latestPosition) {
      return {
        allowed: false,
        reason: 'lock_position_unknown',
        cardRole: card.role,
        activeGeofences: [],
      };
    }

    const normalizedTerminalId = terminalId.toUpperCase();
    const geofences = await this.geofencesRepository.find({
      where: { terminalIds: ArrayContains([normalizedTerminalId]) },
    });
    const evaluatedGeofences: Array<{
      geofence: Geofence;
      inShape: boolean;
      blocksAccess: boolean;
    }> = [];

    for (const geofence of geofences) {
      const inShape = await this.isPositionInGeofence(
        latestPosition.latitude,
        latestPosition.longitude,
        geofence,
      );

      evaluatedGeofences.push({
        geofence,
        inShape,
        blocksAccess: geofenceBlocksLimitedRfidAccess(geofence, inShape),
      });
    }
    const activeGeofences = evaluatedGeofences.filter((item) => item.inShape);
    const limitedRfidAllowed =
      isLimitedRfidAllowedByGeofences(evaluatedGeofences);
    const blockingGeofences = limitedRfidAllowed
      ? []
      : evaluatedGeofences.filter(
          (item) =>
            item.blocksAccess ||
            (item.geofence.accessMode === GeofenceAccessMode.AllowInside &&
              !item.inShape),
        );

    return {
      allowed: limitedRfidAllowed,
      reason: limitedRfidAllowed
        ? 'limited_card_allowed'
        : 'blocked_by_geofence',
      cardRole: card.role,
      position: {
        lat: latestPosition.latitude,
        lng: latestPosition.longitude,
      },
      activeGeofences: activeGeofences.map(({ geofence }) => ({
        id: geofence.id,
        name: geofence.name,
        lockAccessAllowed: normalizeGeofenceRules(geofence.rules)
          .lockAccessAllowed,
        rfidAllowed: normalizeGeofenceRules(geofence.rules).rfidAllowed,
        accessMode: geofence.accessMode,
        shapeType: geofence.shapeType,
        geoBoundaryId: geofence.geoBoundaryId,
      })),
      blockingGeofences: blockingGeofences.map(({ geofence, inShape }) => ({
        id: geofence.id,
        name: geofence.name,
        inShape,
      })),
    };
  }

  private assertGeofenceShape(dto: {
    shapeType: GeofenceShapeType;
    coordinates: Array<{ lat: number; lng: number }>;
    radiusMeters?: number | null;
    geoBoundaryId?: string | null;
  }): void {
    if (dto.geoBoundaryId) {
      return;
    }

    if (
      dto.shapeType === GeofenceShapeType.Polygon &&
      dto.coordinates.length < 3
    ) {
      throw new BadRequestException(
        'Polygon geofences require at least 3 points',
      );
    }

    if (dto.shapeType === GeofenceShapeType.Circle && !dto.radiusMeters) {
      throw new BadRequestException('Circle geofences require radiusMeters');
    }

    if (dto.shapeType === GeofenceShapeType.Route) {
      if (dto.coordinates.length < 2) {
        throw new BadRequestException(
          'Route geofences require at least 2 points',
        );
      }

      if (!dto.radiusMeters) {
        throw new BadRequestException('Route geofences require radiusMeters');
      }
    }
  }

  private async validateTerminalIds(terminalIds: string[]): Promise<string[]> {
    const normalized = [
      ...new Set(terminalIds.map((terminalId) => terminalId.toUpperCase())),
    ];
    const locks = await this.locksRepository.find({
      where: { terminalId: In(normalized) },
      select: { terminalId: true },
    });
    const found = new Set(locks.map((lock) => lock.terminalId.toUpperCase()));
    const missing = normalized.filter((terminalId) => !found.has(terminalId));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown lock terminalId(s): ${missing.join(', ')}`,
      );
    }

    return normalized;
  }

  private async applyCurrentRulesForLocks(
    terminalIds: string[],
  ): Promise<void> {
    const uniqueTerminalIds = [...new Set(terminalIds)];

    for (const terminalId of uniqueTerminalIds) {
      try {
        await this.tcpGatewayService.applyCurrentGeofenceState(terminalId);
      } catch (error) {
        this.logger.warn(
          `Could not apply current geofence RFID state for ${terminalId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async isPositionInGeofence(
    latitude: number,
    longitude: number,
    geofence: Geofence,
  ): Promise<boolean> {
    if (geofence.geoBoundaryId) {
      return this.geoBoundariesService.pointIsInside(
        geofence.geoBoundaryId,
        latitude,
        longitude,
      );
    }

    return isPointInGeofence(latitude, longitude, geofence);
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

function hasUpdateValues(dto: UpdateGeofenceDto): boolean {
  return (
    dto.name !== undefined ||
    dto.terminalIds !== undefined ||
    dto.shapeType !== undefined ||
    dto.coordinates !== undefined ||
    dto.radiusMeters !== undefined ||
    dto.accessMode !== undefined ||
    (dto.rules !== undefined && Object.keys(dto.rules).length > 0)
  );
}

function parseP59Response(parts: string[]) {
  return {
    success: true,
    sms: Number.parseInt(parts[2] ?? '0', 10),
    gprs: Number.parseInt(parts[3] ?? '0', 10),
    rfid: Number.parseInt(parts[4] ?? '0', 10),
    serial: Number.parseInt(parts[5] ?? '0', 10),
    bluetooth: Number.parseInt(parts[6] ?? '0', 10),
  };
}

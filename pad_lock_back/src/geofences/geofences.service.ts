import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoBoundariesService } from '../geo-boundaries/geo-boundaries.service';
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
import { UnlockChannelsDto } from './dto/unlock-channels.dto';
import {
  Geofence,
  GeofenceAccessMode,
  GeofenceShapeType,
} from './geofence.entity';
import {
  isLockAccessAllowedByGeofence,
  isPointInGeofence,
} from './geofence-geometry';

@Injectable()
export class GeofencesService {
  constructor(
    @InjectRepository(Geofence)
    private readonly geofencesRepository: Repository<Geofence>,
    @InjectRepository(RfidCard)
    private readonly rfidCardsRepository: Repository<RfidCard>,
    private readonly geoBoundariesService: GeoBoundariesService,
    private readonly tcpGatewayService: TcpGatewayService,
    private readonly positionsService: PositionsService,
  ) {}

  findAll(): Promise<Geofence[]> {
    return this.geofencesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateGeofenceDto) {
    this.assertGeofenceShape(dto);
    const geofence = await this.geofencesRepository.save(
      this.geofencesRepository.create({
        ...dto,
        radiusMeters: dto.radiusMeters ?? null,
        applyInside:
          dto.applyInside ?? dto.accessMode === GeofenceAccessMode.AllowInside,
      }),
    );
    return { success: true, id: geofence.id };
  }

  async createFromBoundary(dto: CreateGeofenceFromBoundaryDto) {
    await this.geoBoundariesService.findOne(dto.geoBoundaryId);

    const geofence = await this.geofencesRepository.save(
      this.geofencesRepository.create({
        name: dto.name,
        geoBoundaryId: dto.geoBoundaryId,
        shapeType: GeofenceShapeType.Polygon,
        coordinates: [],
        radiusMeters: null,
        applyInside: dto.accessMode === GeofenceAccessMode.AllowInside,
        accessMode: dto.accessMode,
        rules: dto.rules,
      }),
    );

    return { success: true, id: geofence.id };
  }

  async delete(id: string) {
    const result = await this.geofencesRepository.delete({ id });

    if (!result.affected) {
      throw new NotFoundException('Geofence not found');
    }

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

    const geofences = await this.geofencesRepository.find();
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
      const accessModeAllows = this.isAccessModeAllowed(
        latestPosition.latitude,
        latestPosition.longitude,
        geofence,
        inShape,
      );
      const activeRuleBlocks =
        inShape &&
        (geofence.rules.lockAccessAllowed === false ||
          geofence.rules.rfidAllowed === false);

      evaluatedGeofences.push({
        geofence,
        inShape,
        blocksAccess: !accessModeAllows || activeRuleBlocks,
      });
    }
    const activeGeofences = evaluatedGeofences.filter((item) => item.inShape);
    const blockingGeofences = evaluatedGeofences.filter(
      (item) => item.blocksAccess,
    );

    return {
      allowed: blockingGeofences.length === 0,
      reason:
        blockingGeofences.length === 0
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
        lockAccessAllowed: geofence.rules.lockAccessAllowed,
        rfidAllowed: geofence.rules.rfidAllowed,
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

  private assertGeofenceShape(dto: CreateGeofenceDto): void {
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

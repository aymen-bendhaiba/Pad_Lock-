import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildUnlockChannelsQueryCommand,
  buildUnlockChannelsSetCommand,
} from '../protocol/jt701d-commands';
import { TcpGatewayService } from '../tcp/tcp-gateway.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { UnlockChannelsDto } from './dto/unlock-channels.dto';
import { Geofence } from './geofence.entity';

@Injectable()
export class GeofencesService {
  constructor(
    @InjectRepository(Geofence)
    private readonly geofencesRepository: Repository<Geofence>,
    private readonly tcpGatewayService: TcpGatewayService,
  ) {}

  findAll(): Promise<Geofence[]> {
    return this.geofencesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateGeofenceDto) {
    const geofence = await this.geofencesRepository.save(
      this.geofencesRepository.create(dto),
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

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { SetUnlockChannelsDto } from './dto/unlock-channels.dto';
import { GeofencesService } from './geofences.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) {}

  @Get('geofences')
  findAll() {
    return this.geofencesService.findAll();
  }

  @Post('geofences')
  create(@Body() dto: CreateGeofenceDto) {
    return this.geofencesService.create(dto);
  }

  @Delete('geofences/:id')
  delete(@Param('id') id: string) {
    return this.geofencesService.delete(id);
  }

  @Get('geofence/device/query/:terminalId')
  queryUnlockChannels(@Param('terminalId') terminalId: string) {
    return this.geofencesService.queryUnlockChannels(terminalId);
  }

  @Post('geofence/device/set')
  setUnlockChannels(@Body() dto: SetUnlockChannelsDto) {
    return this.geofencesService.setUnlockChannels(dto.terminalId, dto);
  }
}

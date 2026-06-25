import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CheckCardAccessDto } from './dto/check-card-access.dto';
import { CreateGeofenceFromBoundaryDto } from './dto/create-geofence-from-boundary.dto';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { FindGeofencesQueryDto } from './dto/find-geofences-query.dto';
import { SetUnlockChannelsDto } from './dto/unlock-channels.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import { GeofencesService } from './geofences.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) {}

  @Get('geofences')
  findAll(@Query() query: FindGeofencesQueryDto) {
    return this.geofencesService.findAll(query);
  }

  @Post('geofences')
  create(@Body() dto: CreateGeofenceDto) {
    return this.geofencesService.create(dto);
  }

  @Post('geofences/from-boundary')
  createFromBoundary(@Body() dto: CreateGeofenceFromBoundaryDto) {
    return this.geofencesService.createFromBoundary(dto);
  }

  @Patch('geofences/:id')
  update(@Param('id') id: string, @Body() dto: UpdateGeofenceDto) {
    return this.geofencesService.update(id, dto);
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

  @Post('locks/:terminalId/access/check')
  checkCardAccess(
    @Param('terminalId') terminalId: string,
    @Body() dto: CheckCardAccessDto,
  ) {
    return this.geofencesService.checkCardAccess(terminalId, dto);
  }
}

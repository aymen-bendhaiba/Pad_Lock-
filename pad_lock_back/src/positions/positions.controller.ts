import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { HistoryQueryDto } from './dto/history-query.dto';
import { FindDevicesQueryDto } from './dto/find-devices-query.dto';
import { PositionsService } from './positions.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('devices')
  findActiveDevices(@Query() query: FindDevicesQueryDto) {
    return this.positionsService.findActiveDevices(query);
  }

  @Get('history/:terminalId')
  findHistory(
    @Param('terminalId') terminalId: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.positionsService.findHistory(terminalId, query);
  }
}

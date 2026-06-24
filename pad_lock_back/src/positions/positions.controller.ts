import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { HistoryQueryDto } from './dto/history-query.dto';
import { PositionsService } from './positions.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('devices')
  findActiveDevices() {
    return this.positionsService.findActiveDevices();
  }

  @Get('history/:terminalId')
  findHistory(
    @Param('terminalId') terminalId: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.positionsService.findHistory(terminalId, query);
  }
}

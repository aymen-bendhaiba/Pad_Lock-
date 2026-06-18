import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  findTodayHistory(@Param('terminalId') terminalId: string) {
    return this.positionsService.findTodayHistory(terminalId);
  }
}

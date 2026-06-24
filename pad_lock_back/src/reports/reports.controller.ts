import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  AlertsReportQueryDto,
  BatteryReportQueryDto,
  GeofencesReportQueryDto,
  MileageReportQueryDto,
  UnlocksReportQueryDto,
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('alerts')
  alerts(@Query() query: AlertsReportQueryDto) {
    return this.reportsService.alerts(query);
  }

  @Get('geofences')
  geofences(@Query() query: GeofencesReportQueryDto) {
    return this.reportsService.geofences(query);
  }

  @Get('unlocks')
  unlocks(@Query() query: UnlocksReportQueryDto) {
    return this.reportsService.unlocks(query);
  }

  @Get('mileage')
  mileage(@Query() query: MileageReportQueryDto) {
    return this.reportsService.mileage(query);
  }

  @Get('battery')
  battery(@Query() query: BatteryReportQueryDto) {
    return this.reportsService.battery(query);
  }
}

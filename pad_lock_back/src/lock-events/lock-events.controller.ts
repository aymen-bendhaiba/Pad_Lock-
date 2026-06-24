import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  MessageEvent,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateLockEventDto } from './dto/create-lock-event.dto';
import { FindAlertsQueryDto } from './dto/find-alerts-query.dto';
import { UpdateAlertStatusDto } from './dto/update-alert-status.dto';
import { LockEventsService } from './lock-events.service';

@Controller()
export class LockEventsController {
  constructor(private readonly lockEventsService: LockEventsService) {}

  @UseGuards(JwtAuthGuard)
  @Sse('alerts/stream')
  streamAlerts(
    @Query('terminalId') terminalId?: string,
  ): Observable<MessageEvent> {
    return this.lockEventsService.streamAlerts(terminalId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('alerts')
  findLatest(@Query() query: FindAlertsQueryDto) {
    return this.lockEventsService.findLatest(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('locks/:terminalId/events')
  findForLock(
    @Param('terminalId') terminalId: string,
    @Query() query: FindAlertsQueryDto,
  ) {
    return this.lockEventsService.findLatest({
      ...query,
      terminalId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('alerts/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAlertStatusDto) {
    return this.lockEventsService.updateStatus(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('locks/:terminalId/events')
  create(
    @Param('terminalId') terminalId: string,
    @Body() dto: CreateLockEventDto,
  ) {
    return this.lockEventsService.create(terminalId, dto);
  }
}

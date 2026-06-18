import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateLockEventDto } from './dto/create-lock-event.dto';
import { LockEventsService } from './lock-events.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class LockEventsController {
  constructor(private readonly lockEventsService: LockEventsService) {}

  @Get('alerts')
  findLatest(@Query('terminalId') terminalId?: string) {
    return this.lockEventsService.findLatest(terminalId);
  }

  @Get('locks/:terminalId/events')
  findForLock(@Param('terminalId') terminalId: string) {
    return this.lockEventsService.findLatest(terminalId);
  }

  @Post('locks/:terminalId/events')
  create(
    @Param('terminalId') terminalId: string,
    @Body() dto: CreateLockEventDto,
  ) {
    return this.lockEventsService.create(terminalId, dto);
  }
}

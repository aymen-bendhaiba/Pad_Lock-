import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommandsService } from './commands.service';
import {
  BatteryThresholdDto,
  DeepSleepDto,
  ModifyPasswordDto,
  TerminalIdDto,
  UnlockDto,
  VipPhoneDto,
  VipSmsDto,
} from './dto/lock-command.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post('unlock')
  unlock(@Body() dto: UnlockDto) {
    return this.commandsService.unlock(dto);
  }

  @Post('clearcache')
  clearCache(@Body() dto: TerminalIdDto) {
    return this.commandsService.clearCache(dto);
  }

  @Post('restart')
  restart(@Body() dto: TerminalIdDto) {
    return this.commandsService.restart(dto);
  }

  @Post('battery/threshold/set')
  setBatteryThreshold(@Body() dto: BatteryThresholdDto) {
    return this.commandsService.setBatteryThreshold(dto);
  }

  @Get('battery/threshold/query/:terminalId')
  queryBatteryThreshold(@Param('terminalId') terminalId: string) {
    return this.commandsService.queryBatteryThreshold(terminalId);
  }

  @Post('password/modify')
  modifyPassword(@Body() dto: ModifyPasswordDto) {
    return this.commandsService.modifyPassword(dto);
  }

  @Get('password/query/:terminalId')
  queryPassword(@Param('terminalId') terminalId: string) {
    return this.commandsService.queryPassword(terminalId);
  }

  @Post('deepsleep/set')
  setDeepSleep(@Body() dto: DeepSleepDto) {
    return this.commandsService.setDeepSleep(dto);
  }

  @Get('deepsleep/query/:terminalId')
  queryDeepSleep(@Param('terminalId') terminalId: string) {
    return this.commandsService.queryDeepSleep(terminalId);
  }

  @Post('vip/phone/set')
  setVipPhone(@Body() dto: VipPhoneDto) {
    return this.commandsService.setVipPhone(dto);
  }

  @Get('vip/phone/query/:terminalId/:index')
  queryVipPhone(
    @Param('terminalId') terminalId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.commandsService.queryVipPhone(terminalId, index);
  }

  @Post('vip/sms/set')
  setVipSms(@Body() dto: VipSmsDto) {
    return this.commandsService.setVipSms(dto);
  }

  @Get('vip/sms/query/:terminalId')
  queryVipSms(@Param('terminalId') terminalId: string) {
    return this.commandsService.queryVipSms(terminalId);
  }
}

import { Injectable } from '@nestjs/common';
import {
  buildBatteryThresholdQueryCommand,
  buildBatteryThresholdSetCommand,
  buildClearCacheCommand,
  buildDeepSleepQueryCommand,
  buildDeepSleepSetCommand,
  buildRestartCommand,
  buildStaticPasswordModifyCommand,
  buildStaticPasswordQueryCommand,
  buildStaticUnlockCommand,
  buildVipPhoneQueryCommand,
  buildVipPhoneSetCommand,
  buildVipSmsQueryCommand,
  buildVipSmsSetCommand,
} from '../protocol/jt701d-commands';
import { TcpGatewayService } from '../tcp/tcp-gateway.service';
import {
  BatteryThresholdDto,
  DeepSleepDto,
  ModifyPasswordDto,
  TerminalIdDto,
  UnlockDto,
  VipPhoneDto,
  VipSmsDto,
} from './dto/lock-command.dto';

@Injectable()
export class CommandsService {
  constructor(private readonly tcpGatewayService: TcpGatewayService) {}

  unlock(dto: UnlockDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P43',
      buildStaticUnlockCommand(dto.password),
      (parts) => ({
        success: parts[2] === '1',
        errors: parts[3] ?? '0',
      }),
    );
  }

  clearCache(dto: TerminalIdDto) {
    return this.tcpGatewayService.sendCommandNoWait(
      dto.terminalId,
      buildClearCacheCommand(),
    );
  }

  restart(dto: TerminalIdDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P15',
      buildRestartCommand(),
      () => ({
        success: true,
        message:
          'The lock confirmed the restart request. It should reboot shortly.',
      }),
    );
  }

  setBatteryThreshold(dto: BatteryThresholdDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P61',
      buildBatteryThresholdSetCommand(dto.threshold),
      parseBatteryThreshold,
    );
  }

  queryBatteryThreshold(terminalId: string) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P61',
      buildBatteryThresholdQueryCommand(),
      parseBatteryThreshold,
    );
  }

  modifyPassword(dto: ModifyPasswordDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P44',
      buildStaticPasswordModifyCommand(dto.currentPassword, dto.newPassword),
      (parts) => ({
        success: parts[2] === '1',
        message:
          parts[2] === '1'
            ? 'Static password changed successfully.'
            : 'Static password change failed.',
      }),
    );
  }

  queryPassword(terminalId: string) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P44',
      buildStaticPasswordQueryCommand(),
      (parts) => ({ success: true, password: parts[2] ?? '' }),
    );
  }

  setDeepSleep(dto: DeepSleepDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P03',
      buildDeepSleepSetCommand(dto.enabled, dto.threshold),
      parseDeepSleep,
    );
  }

  queryDeepSleep(terminalId: string) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P03',
      buildDeepSleepQueryCommand(),
      parseDeepSleep,
    );
  }

  setVipPhone(dto: VipPhoneDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P11',
      buildVipPhoneSetCommand(dto.index, dto.phoneNumber),
      parseVipPhone,
    );
  }

  queryVipPhone(terminalId: string, index: number) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P11',
      buildVipPhoneQueryCommand(index),
      parseVipPhone,
    );
  }

  setVipSms(dto: VipSmsDto) {
    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P12',
      buildVipSmsSetCommand([dto.vip1, dto.vip2, dto.vip3, dto.vip4, dto.vip5]),
      parseVipSms,
    );
  }

  queryVipSms(terminalId: string) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P12',
      buildVipSmsQueryCommand(),
      parseVipSms,
    );
  }
}

function parseBatteryThreshold(parts: string[]) {
  return {
    success: true,
    threshold: Number.parseInt(parts[2] ?? '0', 10),
  };
}

function parseDeepSleep(parts: string[]) {
  return {
    success: true,
    enabled: Number.parseInt(parts[2] ?? '0', 10) === 1,
    threshold: Number.parseInt(parts[3] ?? '0', 10),
  };
}

function parseVipPhone(parts: string[]) {
  return {
    success: true,
    index: Number.parseInt(parts[2] ?? '0', 10),
    phoneNumber: parts[3] ?? '',
  };
}

function parseVipSms(parts: string[]) {
  return {
    success: true,
    vip1: Number.parseInt(parts[2] ?? '0', 10),
    vip2: Number.parseInt(parts[3] ?? '0', 10),
    vip3: Number.parseInt(parts[4] ?? '0', 10),
    vip4: Number.parseInt(parts[5] ?? '0', 10),
    vip5: Number.parseInt(parts[6] ?? '0', 10),
  };
}

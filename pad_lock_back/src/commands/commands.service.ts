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

type VipPhoneResponse = {
  success: boolean;
  index: number;
  phoneNumber: string;
};

@Injectable()
export class CommandsService {
  constructor(private readonly tcpGatewayService: TcpGatewayService) {}

  unlock(dto: UnlockDto) {
    const command = buildStaticUnlockCommand(dto.password);

    return this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P43',
      command,
      (parts) => ({
        command,
        ...parseStaticUnlock(parts),
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

  async setVipPhone(dto: VipPhoneDto) {
    const response = await this.tcpGatewayService.sendCommand(
      dto.terminalId,
      'P11',
      buildVipPhoneSetCommand(dto.index, dto.phoneNumber),
      parseVipPhone,
    );
    const smsAlerts = await this.setVipSmsSlot(dto.terminalId, dto.index, 1);

    return {
      ...response,
      smsAlertEnabled: true,
      smsAlerts,
    };
  }

  queryVipPhone(terminalId: string, index: number) {
    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P11',
      buildVipPhoneQueryCommand(index),
      parseVipPhone,
    );
  }

  async queryVipPhones(terminalId: string, index?: number) {
    if (index !== undefined) {
      return this.queryVipPhone(terminalId, index);
    }

    const phones: VipPhoneResponse[] = [];

    for (const slot of [1, 2, 3, 4, 5]) {
      phones.push(await this.queryVipPhone(terminalId, slot));
    }

    return {
      success: true,
      terminalId: terminalId.toUpperCase(),
      phones,
    };
  }

  async deleteVipPhone(terminalId: string, index: number) {
    const response = await this.tcpGatewayService.sendCommand(
      terminalId,
      'P11',
      buildVipPhoneSetCommand(index, ''),
      parseVipPhone,
    );
    const smsAlerts = await this.setVipSmsSlot(terminalId, index, 0);

    return {
      ...response,
      deleted: true,
      phoneNumber: '',
      smsAlertEnabled: false,
      smsAlerts,
    };
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

  private async setVipSmsSlot(terminalId: string, index: number, value: 0 | 1) {
    const current = await this.queryVipSms(terminalId);
    const flags: [number, number, number, number, number] = [
      current.vip1,
      current.vip2,
      current.vip3,
      current.vip4,
      current.vip5,
    ];
    flags[index - 1] = value;

    return this.tcpGatewayService.sendCommand(
      terminalId,
      'P12',
      buildVipSmsSetCommand(flags),
      parseVipSms,
    );
  }
}

function parseStaticUnlock(parts: string[]) {
  const resultCode = parts[2] ?? parts[1] ?? '0';
  const errorCode = parts[3] ?? null;
  const success = resultCode === '1';

  return {
    success,
    resultCode,
    errorCode,
    message: success
      ? 'Unlock command accepted by the lock.'
      : unlockFailureMessage(resultCode, errorCode),
  };
}

function unlockFailureMessage(resultCode: string, errorCode: string | null) {
  if (resultCode === '0') {
    return 'Unlock command was rejected or failed on the lock. Check the static password, lock state, and whether lock access is currently blocked by device settings.';
  }

  return errorCode
    ? `Unlock command failed with result ${resultCode} and error ${errorCode}.`
    : `Unlock command failed with result ${resultCode}.`;
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

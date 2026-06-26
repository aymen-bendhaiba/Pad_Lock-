const CARD_BATCH_LIMIT = 20;

export function buildRfidAddCommand(cards: string[]): string {
  assertCardBatch(cards);
  return `(P41,1,1,${cards.length},${cards.join(',')})`;
}

export function buildRfidDeleteCommand(cards: string[]): string {
  assertCardBatch(cards);
  return `(P41,1,2,${cards.length},${cards.join(',')})`;
}

export function buildRfidClearCommand(): string {
  return '(P41,1,3)';
}

export function buildRfidQueryCommand(group: number): string {
  if (!Number.isInteger(group) || group < 1 || group > 25) {
    throw new Error('RFID card group must be between 1 and 25');
  }

  return `(P41,0,${group})`;
}

export function buildStaticUnlockCommand(password: string): string {
  return `(P43,${password.trim()})`;
}

export function buildClearCacheCommand(): string {
  return '(P98,10,1,0,0)';
}

export function buildRestartCommand(): string {
  return '(P15)';
}

export function buildBatteryThresholdSetCommand(threshold: number): string {
  return `(P61,1,${threshold})`;
}

export function buildBatteryThresholdQueryCommand(): string {
  return '(P61,0)';
}

export function buildStaticPasswordModifyCommand(
  currentPassword: string,
  newPassword: string,
): string {
  return `(P44,${newPassword},${currentPassword})`;
}

export function buildStaticPasswordQueryCommand(): string {
  return '(P44,1)';
}

export function buildDeepSleepSetCommand(
  enabled: boolean,
  threshold: number,
): string {
  return `(P03,1,${enabled ? 1 : 0},${threshold})`;
}

export function buildDeepSleepQueryCommand(): string {
  return '(P03,0)';
}

export function buildVipPhoneSetCommand(
  index: number,
  phoneNumber: string,
): string {
  return `(P11,1,${index},${phoneNumber})`;
}

export function buildVipPhoneQueryCommand(index: number): string {
  return `(P11,0,${index})`;
}

export function buildVipSmsSetCommand(
  flags: [number, number, number, number, number],
): string {
  return `(P12,1,${flags.join(',')})`;
}

export function buildVipSmsQueryCommand(): string {
  return '(P12,0)';
}

export function buildUnlockChannelsSetCommand(input: {
  sms: boolean;
  gprs: boolean;
  rfid: boolean;
  serial: boolean;
  bluetooth: boolean;
}): string {
  return `(P59,1,${flag(input.sms)},${flag(input.gprs)},${flag(input.rfid)},${flag(input.serial)},${flag(input.bluetooth)})`;
}

export function buildUnlockChannelsQueryCommand(): string {
  return '(P59,0)';
}

export function buildSimConfigurationSetCommand(
  sim: 1 | 2,
  input: {
    ipAddress: string;
    port: number;
    apn: string;
    apnUser: string;
    apnPassword: string;
  },
): string {
  const operation = sim === 1 ? 1 : 3;
  return `(P06,${operation},${input.ipAddress},${input.port},${input.apn},${input.apnUser},${input.apnPassword})`;
}

export function buildSimConfigurationQueryCommand(sim: 1 | 2): string {
  return `(P06,${sim === 1 ? 0 : 2})`;
}

export function buildReportingIntervalsSetCommand(
  trackingUploadIntervalSeconds: number,
  wakeUpIntervalMinutes: number,
): string {
  return `(P04,1,${trackingUploadIntervalSeconds},${wakeUpIntervalMinutes})`;
}

export function buildVibrationLevelSetCommand(levelMg: number): string {
  return `(P37,1,${levelMg})`;
}

function assertCardBatch(cards: string[]): void {
  if (cards.length < 1 || cards.length > CARD_BATCH_LIMIT) {
    throw new Error(
      `RFID card batch must contain 1 to ${CARD_BATCH_LIMIT} cards`,
    );
  }
}

function flag(value: boolean): number {
  return value ? 1 : 0;
}

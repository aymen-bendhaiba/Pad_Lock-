export type ParsedJt701dBinary = {
  terminalId: string;
  dataType: number;
  isPositioned: boolean;
  timestamp: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  directionDegrees: number;
  mileage: number;
  satellites: number;
  batteryLevel: string;
  imei: string;
  status: {
    isRopeCut: boolean;
    isVibrationAlarm: boolean;
    isEnterFence: boolean;
    isExitFence: boolean;
    isMotorLocked: boolean;
    isRopeInserted: boolean;
    isUnlockLongAlarm: boolean;
    isWrongPasswordAlarm: boolean;
    isIllegalCardAlarm: boolean;
    isLowBatteryAlarm: boolean;
    isBackCoverOpenAlarm: boolean;
    isBackCoverClosed: boolean;
    isMotorStuck: boolean;
  };
  wakeupSource: number;
  serialNumber: number;
  rawHex: string;
};

export function parseJt701dBinary(data: Buffer): ParsedJt701dBinary {
  const terminalId = data.slice(1, 6).toString('hex').toUpperCase();
  const dataType = data[7] & 0x0f;
  const bodyLength = (data[8] << 8) | data[9];
  let offset = 10;

  const day = bcd(data[offset]);
  const month = bcd(data[offset + 1]);
  const year = bcd(data[offset + 2]);
  offset += 3;

  const hour = bcd(data[offset]);
  const minute = bcd(data[offset + 1]);
  const second = bcd(data[offset + 2]);
  offset += 3;

  const latitudeRaw = decodeCoordinate(data, offset, false);
  offset += 4;

  const longitudeRaw = decodeCoordinate(data, offset, true);
  const locByte = data[offset + 4] & 0x0f;
  offset += 5;

  const speedKmh = Number((data[offset] * 1.85).toFixed(2));
  offset += 1;

  const directionDegrees = data[offset] * 2;
  offset += 1;

  const mileage = data.readUInt32BE(offset);
  offset += 4;

  const satellites = data[offset];
  offset += 1;

  offset += 4;

  const statusHigh = data[offset];
  const statusLow = data[offset + 1];
  offset += 2;

  const batteryRaw = data[offset];
  offset += 1;

  offset += 6;

  const expandedDeviceStatus = data[offset];
  offset += 1;

  offset += 1;

  const expandedDeviceStatus2 = data[offset];
  offset += 1;

  const imei =
    data.slice(offset, offset + 8).toString('hex', 0, 7) +
    (data[offset + 7] >> 4).toString(16);

  const isNorth = (locByte & 0x02) !== 0;
  const isEast = (locByte & 0x04) !== 0;
  const isPositioned = (locByte & 0x01) !== 0;
  const latitude = Number((isNorth ? latitudeRaw : -latitudeRaw).toFixed(6));
  const longitude = Number((isEast ? longitudeRaw : -longitudeRaw).toFixed(6));
  const isCharging =
    batteryRaw === 0xff || (expandedDeviceStatus2 & 0x01) === 1;

  return {
    terminalId,
    dataType,
    isPositioned,
    timestamp: `20${year}-${month}-${day} ${hour}:${minute}:${second} UTC`,
    latitude,
    longitude,
    speedKmh,
    directionDegrees,
    mileage,
    satellites,
    batteryLevel: isCharging ? 'Charging' : `${batteryRaw}%`,
    imei,
    status: {
      isRopeCut: !!(statusLow & 0x08),
      isVibrationAlarm: !!(statusLow & 0x10),
      isEnterFence: !!(statusLow & 0x02),
      isExitFence: !!(statusLow & 0x04),
      isMotorLocked: !!(statusLow & 0x80),
      isRopeInserted: !!(statusLow & 0x40),
      isUnlockLongAlarm: !!(statusHigh & 0x01),
      isWrongPasswordAlarm: !!(statusHigh & 0x02),
      isIllegalCardAlarm: !!(statusHigh & 0x04),
      isLowBatteryAlarm: !!(statusHigh & 0x08),
      isBackCoverOpenAlarm: !!(statusHigh & 0x10),
      isBackCoverClosed: !!(statusHigh & 0x20),
      isMotorStuck: !!(statusHigh & 0x40),
    },
    wakeupSource: expandedDeviceStatus & 0x0f,
    serialNumber: data[10 + bodyLength - 1],
    rawHex: data.toString('hex').toUpperCase(),
  };
}

function bcd(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

function decodeCoordinate(
  buffer: Buffer,
  offset: number,
  isLongitude: boolean,
): number {
  let value = 0;

  for (let i = 0; i < 4; i += 1) {
    const byte = buffer[offset + i];
    value = value * 100 + ((byte >> 4) * 10 + (byte & 0x0f));
  }

  if (isLongitude) {
    value = value * 10 + ((buffer[offset + 4] >> 4) & 0x0f);
  }

  const degrees = Math.floor(value / 1000000);
  const minutes = (value % 1000000) / 10000.0;
  return degrees + minutes / 60.0;
}

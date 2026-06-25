export type ParsedAsciiFrame =
  | {
      kind: 'time_sync';
      terminalId: string;
    }
  | {
      kind: 'rfid_response';
      terminalId: string;
      opType: number;
      count: number;
      cards: string[];
    }
  | {
      kind: 'p45_report';
      terminalId: string;
      timestamp: string;
      latitude: number | null;
      longitude: number | null;
      isPositioned: boolean;
      speedKmh: number | null;
      directionDegrees: number | null;
      eventSourceCode: string;
      eventSource: string;
      unlockVerification: 'Pass' | 'Reject' | 'N/A';
      rfidCard: string | null;
      passwordCorrect: boolean;
      incorrectPasswordsCount: number;
      serialNumber: number;
      mileage: number;
      imei?: string;
      fenceId?: string;
      raw: string;
    }
  | {
      kind: 'command_response';
      terminalId: string;
      command: string;
      parts: string[];
      raw: string;
    };

const eventSources: Record<string, string> = {
  '1': 'Swipe RFID card',
  '2': 'Swipe illegal RFID card',
  '3': 'Binding vehicle ID card',
  '4': 'Remote static password unlock',
  '5': 'Automatically locked',
  '6': 'Remote dynamic password unlock',
  '7': 'Bluetooth unlock',
  '8': 'Lock rope pull out',
};

export function parseAsciiFrame(frame: string): ParsedAsciiFrame | null {
  const content = frame.replace(/^\(|\)$/g, '');
  const parts = content.split(',');

  if (parts.length < 2) {
    return null;
  }

  const [terminalId, command] = parts;

  if (command === 'P22' && parts[2] === '2') {
    return { kind: 'time_sync', terminalId };
  }

  if (command === 'P41') {
    return {
      kind: 'rfid_response',
      terminalId,
      opType: Number.parseInt(parts[2] ?? '0', 10),
      count: Number.parseInt(parts[3] ?? '0', 10),
      cards: parts.slice(4).filter(Boolean),
    };
  }

  if (command === 'P45' && parts.length >= 18) {
    const eventSourceCode = parts[11];
    const unlockVerificationValue = Number.parseInt(parts[12] ?? '0', 10);
    const latitude = coordinateOrNull(parts[4], parts[5], 'S');
    const longitude = coordinateOrNull(parts[6], parts[7], 'W');

    return {
      kind: 'p45_report',
      terminalId,
      timestamp: `20${parts[2].substring(4, 6)}-${parts[2].substring(2, 4)}-${parts[2].substring(0, 2)} ${parts[3].substring(0, 2)}:${parts[3].substring(2, 4)}:${parts[3].substring(4, 6)} UTC`,
      latitude,
      longitude,
      isPositioned: parts[8] === 'A',
      speedKmh: numberOrNull(parts[9]),
      directionDegrees: intOrNull(parts[10]),
      eventSourceCode,
      eventSource:
        eventSources[eventSourceCode] ?? `Unknown (${eventSourceCode})`,
      unlockVerification: unlockVerification(
        eventSourceCode,
        unlockVerificationValue,
      ),
      rfidCard: parts[13] !== '0000000000' ? parts[13] : null,
      passwordCorrect: parts[14] === '1',
      incorrectPasswordsCount: Number.parseInt(parts[15] ?? '0', 10),
      serialNumber: Number.parseInt(parts[16] ?? '0', 10),
      mileage: Number.parseInt(parts[17] ?? '0', 10),
      imei: parts[18],
      fenceId: parts[19],
      raw: frame,
    };
  }

  return {
    kind: 'command_response',
    terminalId,
    command,
    parts,
    raw: frame,
  };
}

function unlockVerification(
  eventSourceCode: string,
  value: number,
): 'Pass' | 'Reject' | 'N/A' {
  if (['2', '3', '5', '8'].includes(eventSourceCode)) {
    return 'N/A';
  }

  if (eventSourceCode === '1' || eventSourceCode === '6') {
    return (value >= 1 && value <= 10) || value === 98 ? 'Pass' : 'Reject';
  }

  if (eventSourceCode === '4' || eventSourceCode === '7') {
    return value === 1 ? 'Pass' : 'Reject';
  }

  return 'N/A';
}

function coordinateOrNull(
  value: string,
  direction: string,
  negativeDirection: string,
) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return direction === negativeDirection ? -parsed : parsed;
}

function numberOrNull(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

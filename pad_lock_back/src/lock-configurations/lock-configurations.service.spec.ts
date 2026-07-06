import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  LockConfiguration,
  LockConfigurationSyncStatus,
} from './lock-configuration.entity';
import { LockConfigurationsService } from './lock-configurations.service';

function fixture(input?: {
  connected?: boolean;
  sendError?: Error;
  existing?: Record<string, unknown> | null;
}) {
  let stored: Partial<LockConfiguration> | null =
    (input?.existing as Partial<LockConfiguration> | undefined) ?? null;
  const repository = {
    findOneBy: jest.fn(() =>
      Promise.resolve<Partial<LockConfiguration> | null>(stored),
    ),
    create: jest.fn(
      (value: Partial<LockConfiguration>): Partial<LockConfiguration> => ({
        ...value,
      }),
    ),
    save: jest.fn((value: Partial<LockConfiguration>) => {
      stored = {
        id: 'configuration-1',
        createdAt: new Date('2026-06-24T10:00:00.000Z'),
        updatedAt: new Date('2026-06-24T10:00:00.000Z'),
        ...value,
      };
      return Promise.resolve(stored);
    }),
  };
  const sendCommand = jest.fn(
    (
      ...args: [string, string, string, (parts: string[]) => unknown]
    ): Promise<{ success: boolean }> => {
      void args;

      if (input?.sendError) {
        return Promise.reject(input.sendError);
      }

      return Promise.resolve({ success: true });
    },
  );
  const tcpGateway = {
    isConnected: jest.fn().mockReturnValue(input?.connected ?? true),
    sendCommand,
  };
  const service = new LockConfigurationsService(
    repository as never,
    {
      findByTerminalIdOrFail: jest.fn().mockResolvedValue({
        id: 'lock-1',
        terminalId: '8034400004',
      }),
    } as never,
    {
      getOrThrow: jest
        .fn()
        .mockReturnValue('test-device-configuration-encryption-key'),
    } as never,
    tcpGateway as never,
  );

  return {
    service,
    repository,
    tcpGateway,
    getStored: () => stored,
  };
}

describe('LockConfigurationsService', () => {
  it('sends affected commands in device-safe order and marks them synced', async () => {
    const { service, tcpGateway, getStored } = fixture();

    const response = await service.update('8034400004', {
      sim1: {
        ipAddress: 'main.example.com',
        port: 10001,
        apn: 'main-apn',
      },
      sim2: {
        ipAddress: 'backup.example.com',
        port: 10002,
        apn: 'backup-apn',
      },
      trackingUploadIntervalSeconds: 60,
      wakeUpIntervalMinutes: 45,
      vibrationLevelMg: 200,
    });

    expect(tcpGateway.sendCommand.mock.calls.map((call) => call[1])).toEqual([
      'P04',
      'P37',
      'P06',
      'P06',
    ]);
    expect(tcpGateway.sendCommand.mock.calls.map((call) => call[2])).toEqual([
      '(P04,1,60,45)',
      '(P37,1,200)',
      '(P06,3,backup.example.com,10002,backup-apn,,)',
      '(P06,1,main.example.com,10001,main-apn,,)',
    ]);
    expect(getStored()?.sim1SyncStatus).toBe(
      LockConfigurationSyncStatus.Synced,
    );
    expect(response.sync.reporting.status).toBe(
      LockConfigurationSyncStatus.Synced,
    );
  });

  it('sends only the section changed by a partial patch', async () => {
    const { service, tcpGateway } = fixture({
      existing: {
        id: 'configuration-1',
        lockDeviceId: 'lock-1',
        trackingUploadIntervalSeconds: 30,
        wakeUpIntervalMinutes: 30,
        vibrationLevelMg: 126,
        sim1IpAddress: null,
        sim1Port: null,
        sim1Apn: null,
        sim1ApnUser: null,
        sim1ApnPasswordEncrypted: null,
        sim2IpAddress: null,
        sim2Port: null,
        sim2Apn: null,
        sim2ApnUser: null,
        sim2ApnPasswordEncrypted: null,
      },
    });

    await service.update('8034400004', { vibrationLevelMg: 250 });

    expect(tcpGateway.sendCommand).toHaveBeenCalledTimes(1);
    expect(tcpGateway.sendCommand).toHaveBeenCalledWith(
      '8034400004',
      'P37',
      '(P37,1,250)',
      expect.any(Function),
    );
  });

  it('keeps offline updates pending without sending a command', async () => {
    const { service, tcpGateway, getStored } = fixture({ connected: false });

    const response = await service.update('8034400004', {
      trackingUploadIntervalSeconds: 90,
    });

    expect(tcpGateway.sendCommand).not.toHaveBeenCalled();
    expect(getStored()?.reportingSyncStatus).toBe(
      LockConfigurationSyncStatus.Pending,
    );
    expect(response.sync.reporting.status).toBe(
      LockConfigurationSyncStatus.Pending,
    );
  });

  it('marks a connected command failure for a later retry', async () => {
    const { service, getStored } = fixture({
      sendError: new Error('Device rejected P37'),
    });

    const response = await service.update('8034400004', {
      vibrationLevelMg: 180,
    });

    expect(getStored()?.vibrationSyncStatus).toBe(
      LockConfigurationSyncStatus.Failed,
    );
    expect(response.sync.vibration.error).toBe('Device rejected P37');
  });

  it('encrypts APN passwords and never returns them', async () => {
    const { service, getStored } = fixture();

    const response = await service.update('8034400004', {
      sim1: {
        ipAddress: 'main.example.com',
        port: 10001,
        apn: 'internet',
        apnUser: 'network-user',
        apnPassword: 'network-password',
      },
    });

    expect(getStored()?.sim1ApnPasswordEncrypted).not.toBe('network-password');
    expect(String(getStored()?.sim1ApnPasswordEncrypted)).toContain('.');
    expect(response.sim1).toEqual({
      ipAddress: 'main.example.com',
      port: 10001,
      apn: 'internet',
      apnUser: 'network-user',
      apnPasswordConfigured: true,
    });
    expect(JSON.stringify(response)).not.toContain('network-password');
  });

  it('returns the saved configuration without querying a connected lock', async () => {
    const { service, tcpGateway } = fixture({
      existing: {
        id: 'configuration-1',
        lockDeviceId: 'lock-1',
        sim1IpAddress: 'saved-main.example.com',
        sim1Port: 10001,
        sim1Apn: 'saved-apn',
        sim1ApnUser: '',
        sim1ApnPasswordEncrypted: null,
        sim2IpAddress: null,
        sim2Port: null,
        sim2Apn: null,
        sim2ApnUser: null,
        sim2ApnPasswordEncrypted: null,
        trackingUploadIntervalSeconds: 30,
        wakeUpIntervalMinutes: 30,
        vibrationLevelMg: 126,
      },
    });

    const response = await service.findOne('8034400004');

    expect(tcpGateway.sendCommand).not.toHaveBeenCalled();
    expect(response.sim1).toMatchObject({
      ipAddress: 'saved-main.example.com',
      port: 10001,
      apn: 'saved-apn',
    });
  });

  it('queries connected locks for SIM configuration when refreshing', async () => {
    const { service, tcpGateway, getStored } = fixture({ existing: null });
    tcpGateway.sendCommand.mockImplementation(
      (
        _terminalId: string,
        _commandWord: string,
        command: string,
        parser: (parts: string[]) => unknown,
      ) => {
        if (command === '(P06,0)') {
          return Promise.resolve(
            parser([
              '8034400004',
              'P06',
              '0',
              'jt701.jointcontrols.com',
              '10001',
              'CMIOT',
              'user1',
              'pass1',
            ]),
          );
        }

        return Promise.resolve(
          parser([
            '8034400004',
            'P06',
            '2',
            '120.24.26.10',
            '10001',
            'internet',
            '',
            '',
          ]),
        );
      },
    );

    const response = await service.refresh('8034400004');

    expect(tcpGateway.sendCommand.mock.calls.map((call) => call[2])).toEqual([
      '(P06,0)',
      '(P06,2)',
    ]);
    expect(response.sim1).toEqual({
      ipAddress: 'jt701.jointcontrols.com',
      port: 10001,
      apn: 'CMIOT',
      apnUser: 'user1',
      apnPasswordConfigured: true,
    });
    expect(response.sim2).toEqual({
      ipAddress: '120.24.26.10',
      port: 10001,
      apn: 'internet',
      apnUser: '',
      apnPasswordConfigured: false,
    });
    expect(getStored()?.sim1IpAddress).toBe('jt701.jointcontrols.com');
    expect(getStored()?.sim1ApnPasswordEncrypted).not.toBe('pass1');
    expect(JSON.stringify(response)).not.toContain('pass1');
  });

  it('does not mark SIM refresh as failed when another P06 query is already pending', async () => {
    const existing = {
      id: 'configuration-1',
      lockDeviceId: 'lock-1',
      sim1IpAddress: 'saved-main.example.com',
      sim1Port: 10001,
      sim1Apn: 'saved-apn',
      sim1ApnUser: '',
      sim1ApnPasswordEncrypted: null,
      sim1SyncStatus: LockConfigurationSyncStatus.Synced,
      sim1SyncError: null,
      sim1SyncedAt: new Date('2026-06-26T11:09:47.633Z'),
      sim2IpAddress: 'saved-backup.example.com',
      sim2Port: 10002,
      sim2Apn: 'saved-backup-apn',
      sim2ApnUser: '',
      sim2ApnPasswordEncrypted: null,
      sim2SyncStatus: LockConfigurationSyncStatus.Synced,
      sim2SyncError: null,
      sim2SyncedAt: new Date('2026-06-26T11:09:48.673Z'),
      trackingUploadIntervalSeconds: 30,
      wakeUpIntervalMinutes: 30,
      vibrationLevelMg: 126,
    };
    const { service, tcpGateway, getStored } = fixture({ existing });
    tcpGateway.sendCommand.mockRejectedValue(
      new ConflictException(
        'P06 command is already waiting for a response from lock 8034400004',
      ),
    );

    await service.refresh('8034400004');

    expect(getStored()?.sim1SyncStatus).toBe(
      LockConfigurationSyncStatus.Synced,
    );
    expect(getStored()?.sim1SyncError).toBeNull();
  });

  it('rejects incomplete first-time SIM configuration and invalid vibration', async () => {
    const { service } = fixture();

    await expect(
      service.update('8034400004', {
        sim1: { apnUser: 'user-only' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.update('8034400004', { vibrationLevelMg: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retries pending sections after a reconnect', async () => {
    const existing = {
      id: 'configuration-1',
      lockDeviceId: 'lock-1',
      trackingUploadIntervalSeconds: 60,
      wakeUpIntervalMinutes: 45,
      vibrationLevelMg: 126,
      reportingSyncStatus: LockConfigurationSyncStatus.Pending,
      vibrationSyncStatus: null,
      sim1SyncStatus: null,
      sim2SyncStatus: null,
      sim1IpAddress: null,
      sim1Port: null,
      sim1Apn: null,
      sim2IpAddress: null,
      sim2Port: null,
      sim2Apn: null,
    };
    const { service, tcpGateway, getStored } = fixture({ existing });

    await service.retryPendingForLock('8034400004');

    expect(tcpGateway.sendCommand).toHaveBeenCalledWith(
      '8034400004',
      'P04',
      '(P04,1,60,45)',
      expect.any(Function),
    );
    expect(getStored()?.reportingSyncStatus).toBe(
      LockConfigurationSyncStatus.Synced,
    );
  });
});

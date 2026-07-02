import { BadRequestException } from '@nestjs/common';
import { LockDeviceStatus } from '../locks/lock-device.entity';
import { PositionsService } from './positions.service';

function fixture(
  total: number,
  rows: Array<{ latitude: number; longitude: number }>,
) {
  const repository = {
    query: jest
      .fn()
      .mockResolvedValueOnce([{ total: String(total) }])
      .mockResolvedValueOnce(rows),
  };
  const tcpConnectionsService = { has: jest.fn().mockReturnValue(false) };
  const locksService = {
    syncStatusesWithCurrentConnections: jest.fn().mockResolvedValue([]),
  };
  const service = new PositionsService(
    repository as never,
    locksService as never,
    tcpConnectionsService as never,
  );

  return { service, repository };
}

describe('PositionsService history', () => {
  it('uses bounded coordinate-only sampling for a date range', async () => {
    const { service, repository } = fixture(6730, [
      { latitude: 33.594, longitude: -7.62 },
      { latitude: 33.595, longitude: -7.619 },
    ]);

    const result = await service.findHistory('8034400004', {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-25T23:59:59.999Z',
      maxPoints: 2000,
    });

    expect(result).toEqual([
      [33.594, -7.62],
      [33.595, -7.619],
    ]);
    expect(repository.query).toHaveBeenLastCalledWith(
      expect.stringContaining('ROW_NUMBER()'),
      expect.arrayContaining(['8034400004', 4, 6730]),
    );
  });

  it('does not run the coordinate query when the range is empty', async () => {
    const { service, repository } = fixture(0, []);

    await expect(
      service.findHistory('8034400004', {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      }),
    ).resolves.toEqual([]);
    expect(repository.query).toHaveBeenCalledTimes(1);
  });

  it('rejects an inverted date range', async () => {
    const { service, repository } = fixture(0, []);

    await expect(
      service.findHistory('8034400004', {
        from: '2026-06-03T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.query).not.toHaveBeenCalled();
  });
});

describe('PositionsService active devices', () => {
  function activeDevicesFixture(rows: unknown[], connected = false) {
    const builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      distinctOn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    const tcpConnectionsService = { has: jest.fn().mockReturnValue(connected) };
    const locksService = {
      syncStatusesWithCurrentConnections: jest.fn().mockResolvedValue([]),
    };
    const service = new PositionsService(
      repository as never,
      locksService as never,
      tcpConnectionsService as never,
    );

    return {
      service,
      repository,
      builder,
      tcpConnectionsService,
      locksService,
    };
  }

  it('marks disconnected lock telemetry unavailable even when the database status is stale', async () => {
    const recordedAt = new Date('2026-06-30T10:00:00.000Z');
    const receivedAt = new Date('2026-06-30T10:00:05.000Z');
    const { service } = activeDevicesFixture([
      {
        terminalId: '8034400004',
        latitude: 33.594,
        longitude: -7.62,
        speedKmh: 42,
        batteryPercentage: 87,
        isCharging: false,
        isLocked: true,
        isPositioned: true,
        mileage: 1200,
        recordedAt,
        receivedAt,
        lockDevice: {
          name: 'Truck lock',
          imei: '123456789',
          status: LockDeviceStatus.Online,
          lastSeenAt: recordedAt,
        },
      },
    ]);

    await expect(service.findActiveDevices()).resolves.toEqual([
      {
        id: '8034400004',
        terminalId: '8034400004',
        name: 'Truck lock',
        imei: '123456789',
        status: LockDeviceStatus.Offline,
        online: false,
        connected: false,
        telemetryAvailable: false,
        connectionStatus: 'not_connected_over_tcp',
        lastSeenAt: '2026-06-30T10:00:00.000Z',
        position: {
          lat: 33.594,
          lng: -7.62,
          speed: null,
          timestamp: receivedAt.getTime(),
          gpsTimestamp: recordedAt.getTime(),
          lastKnownAt: '2026-06-30T10:00:00.000Z',
          battery: null,
          isCharging: null,
          isLocked: null,
          is_positioned: true,
          mileage: null,
          telemetryAvailable: false,
          connectionStatus: 'not_connected_over_tcp',
        },
      },
    ]);
  });

  it('synchronizes lock statuses to the database before returning devices', async () => {
    const { service, locksService } = activeDevicesFixture([]);

    await service.findActiveDevices();

    expect(locksService.syncStatusesWithCurrentConnections).toHaveBeenCalled();
  });

  it('keeps live telemetry for locks connected over TCP', async () => {
    const recordedAt = new Date('2026-06-30T10:00:00.000Z');
    const receivedAt = new Date('2026-06-30T10:00:05.000Z');
    const { service } = activeDevicesFixture(
      [
        {
          terminalId: '8034400004',
          latitude: 33.594,
          longitude: -7.62,
          speedKmh: 42,
          batteryPercentage: 87,
          isCharging: false,
          isLocked: true,
          isPositioned: true,
          mileage: 1200,
          recordedAt,
          receivedAt,
          lockDevice: {
            status: LockDeviceStatus.Online,
            lastSeenAt: recordedAt,
          },
        },
      ],
      true,
    );

    const [device] = await service.findActiveDevices();

    expect(device.status).toBe(LockDeviceStatus.Online);
    expect(device.connected).toBe(true);
    expect(device.position).toMatchObject({
      speed: 42,
      battery: '87%',
      isCharging: false,
      isLocked: true,
      mileage: 1200,
      telemetryAvailable: true,
      connectionStatus: 'connected',
    });
  });
});

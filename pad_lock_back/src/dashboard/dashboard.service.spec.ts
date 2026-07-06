import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const dataSource = {
    query: jest.fn(),
  };
  const locksService = {
    syncStatusesWithCurrentConnections: jest.fn().mockResolvedValue([]),
  };
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    locksService.syncStatusesWithCurrentConnections.mockResolvedValue([]);
    service = new DashboardService(dataSource as never, locksService as never);
  });

  it('uses from/to date range for position activity and alert queries', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        total: '1',
        online: '1',
        offline: '0',
        unknown: '0',
        latestPositions: [
          { terminalId: '8034400004', speedKmh: 10, isLocked: true },
        ],
        alarmCount: '2',
        stoppedCount: '1',
        unlockedCount: '1',
        totalActivities: '4',
        activityRows: [{ day: '2026-06-01', moving: '1', idle: '0' }],
        eventTypeRows: [
          { type: 'low_battery', count: '2' },
          { type: 'locked', count: '1' },
          { type: 'unlocked', count: '1' },
        ],
        topAlarms: [{ type: 'low_battery', count: '2' }],
        syncRows: [{ status: 'synced', count: '1' }],
        topRfidCards: [
          {
            cardNumber: '0006950824',
            label: 'Admin card',
            role: 'admin',
            uses: '8',
          },
        ],
        tripHeatmapRows: [
          { name: 'Casablanca', locked: '2', unlocked: '3', total: '5' },
        ],
      },
    ]);

    const response = await service.summary({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-02T00:00:00.000Z',
    });

    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-02T00:00:00.000Z');

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WITH filtered_positions AS MATERIALIZED'),
      [from, to, []],
    );
    expect(dataSource.query).toHaveBeenCalledTimes(1);
    expect(locksService.syncStatusesWithCurrentConnections).toHaveBeenCalled();
    expect(response.lockActivity.summary).toEqual({
      alarms: 2,
      stopped: 1,
      unlocked: 1,
    });
    expect(response.topRfidCards).toEqual([
      {
        cardNumber: '0006950824',
        label: 'Admin card',
        role: 'admin',
        uses: 8,
      },
    ]);
    expect(response.tripHeatmap).toEqual([
      { name: 'Casablanca', locked: 2, unlocked: 3, total: 5 },
    ]);
    expect(response.heatMapTracks).toEqual([
      {
        location: 'Casablanca',
        value: 5,
        city: 'Casablanca',
        count: 5,
        place: 'Casablanca',
        activity: 5,
        name: 'Casablanca',
        events: 5,
      },
    ]);
  });

  it('pushes the terminal filter into every dashboard data source', async () => {
    locksService.syncStatusesWithCurrentConnections.mockResolvedValue([
      '8034400004',
    ]);
    dataSource.query.mockResolvedValueOnce([
      {
        total: '0',
        online: '0',
        offline: '0',
        unknown: '0',
        latestPositions: [],
        alarmCount: '0',
        stoppedCount: '0',
        unlockedCount: '0',
        totalActivities: '0',
        activityRows: [],
        eventTypeRows: [],
        topAlarms: [],
        syncRows: [],
        topRfidCards: [],
        tripHeatmapRows: [],
      },
    ]);

    await service.summary({ terminalId: '8034400004' });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('AND "terminalId" = $3'),
      expect.arrayContaining(['8034400004', ['8034400004']]),
    );
  });

  it('does not count stale offline telemetry as current movement or lock state', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        total: '2',
        online: '1',
        offline: '1',
        unknown: '0',
        latestPositions: [
          {
            terminalId: '8034400004',
            speedKmh: 12,
            isLocked: true,
            status: 'online',
          },
          {
            terminalId: '8034400005',
            speedKmh: null,
            isLocked: null,
            status: 'offline',
          },
        ],
        alarmCount: '0',
        stoppedCount: '0',
        unlockedCount: '0',
        totalActivities: '0',
        activityRows: [],
        eventTypeRows: [],
        topAlarms: [],
        syncRows: [],
        topRfidCards: [],
        tripHeatmapRows: [],
      },
    ]);

    const response = await service.summary({});

    expect(response.kpis.moving).toBe(1);
    expect(response.kpis.idle).toBe(0);
    expect(response.lockStateDistribution).toEqual({
      locked: 1,
      unlocked: 0,
      unknown: 1,
    });
  });

  it('nulls latest dashboard telemetry in SQL when the lock is offline', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        total: '0',
        online: '0',
        offline: '0',
        unknown: '0',
        latestPositions: [],
        alarmCount: '0',
        stoppedCount: '0',
        unlockedCount: '0',
        totalActivities: '0',
        activityRows: [],
        eventTypeRows: [],
        topAlarms: [],
        syncRows: [],
        topRfidCards: [],
        tripHeatmapRows: [],
      },
    ]);

    await service.summary({});

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('= ANY($3::text[])'),
      expect.any(Array),
    );
  });

  it('rejects invalid dashboard date ranges', async () => {
    await expect(
      service.summary({
        from: '2026-06-03T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

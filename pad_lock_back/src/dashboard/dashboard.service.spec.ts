import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const dataSource = {
    query: jest.fn(),
  };
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(dataSource as never);
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
        activityRows: [{ day: '2026-06-01', moving: '1', idle: '0' }],
        topAlarms: [{ type: 'low_battery', count: '2' }],
        syncRows: [{ status: 'synced', count: '1' }],
      },
    ]);

    await service.summary({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-02T00:00:00.000Z',
    });

    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-02T00:00:00.000Z');

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WITH filtered_positions AS MATERIALIZED'),
      [from, to],
    );
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('pushes the terminal filter into every dashboard data source', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        total: '0',
        online: '0',
        offline: '0',
        unknown: '0',
        latestPositions: [],
        alarmCount: '0',
        activityRows: [],
        topAlarms: [],
        syncRows: [],
      },
    ]);

    await service.summary({ terminalId: '8034400004' });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('AND "terminalId" = $3'),
      expect.arrayContaining(['8034400004']),
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

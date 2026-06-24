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
    dataSource.query
      .mockResolvedValueOnce([
        { total: '1', online: '1', offline: '0', unknown: '0' },
      ])
      .mockResolvedValueOnce([
        { terminalId: '8034400004', speedKmh: 10, isLocked: true },
      ])
      .mockResolvedValueOnce([{ count: '2' }])
      .mockResolvedValueOnce([{ day: '2026-06-01', moving: '1', idle: '0' }])
      .mockResolvedValueOnce([{ type: 'low_battery', count: '2' }])
      .mockResolvedValueOnce([{ status: 'synced', count: '1' }]);

    await service.summary({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-02T00:00:00.000Z',
    });

    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-02T00:00:00.000Z');

    expect(dataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"recordedAt" >= $1'),
      [from, to],
    );
    expect(dataSource.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('"occurredAt" >= $1'),
      [from, to],
    );
    expect(dataSource.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('"recordedAt" >= $1'),
      [from, to],
    );
    expect(dataSource.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('"occurredAt" >= $1'),
      [from, to],
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

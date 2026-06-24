import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('rejects an inverted date range before querying the database', async () => {
    const dataSource = { query: jest.fn() };
    const service = new ReportsService(dataSource as never);

    await expect(
      service.alerts({
        from: '2026-06-25T00:00:00.000Z',
        to: '2026-06-24T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

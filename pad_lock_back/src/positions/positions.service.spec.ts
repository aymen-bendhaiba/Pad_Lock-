import { BadRequestException } from '@nestjs/common';
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
  const service = new PositionsService(repository as never, {} as never);

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

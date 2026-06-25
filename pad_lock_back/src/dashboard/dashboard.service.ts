import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type CountRow = {
  count: string;
};

type KpiRow = {
  total: string;
  online: string;
  offline: string;
  unknown: string;
};

type LatestPositionRow = {
  terminalId: string;
  speedKmh: number | null;
  isLocked: boolean | null;
};

type ActivityRow = {
  day: string;
  moving: string;
  idle: string;
};

type AlarmRow = {
  type: string;
  count: string;
};

type SyncRow = {
  status: string;
  count: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(query: DashboardQueryDto) {
    const { from, to } = dateRange(query);
    const [
      lockCounts,
      latestPositions,
      alarmCount,
      activityRows,
      topAlarms,
      syncRows,
    ] = await Promise.all([
      this.lockCounts(),
      this.latestPositions(from, to),
      this.alarmCount(from, to),
      this.activity(from, to),
      this.topAlarms(from, to),
      this.rfidSyncStatus(),
    ]);
    const movement = movementCounts(latestPositions);
    const lockState = lockStateCounts(latestPositions);
    const totalLocks = Number(lockCounts.total);
    const online = Number(lockCounts.online);
    const offline = Number(lockCounts.offline);
    const connectionPercent =
      totalLocks === 0 ? 0 : Math.round((online / totalLocks) * 100);

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      kpis: {
        totalAssets: totalLocks,
        online,
        offline,
        moving: movement.moving,
        idle: movement.idle,
        locked: lockState.locked,
        unlocked: lockState.unlocked,
        alarm: Number(alarmCount.count),
      },
      connectionStatus: {
        online,
        offline,
        unknown: Number(lockCounts.unknown),
        onlinePercent: connectionPercent,
      },
      lockActivity: {
        days: fillActivityDays(from, to, activityRows),
        pulse: {
          totalReports: activityRows.reduce(
            (sum, row) => sum + Number(row.moving) + Number(row.idle),
            0,
          ),
          movingPercent: percent(movement.moving, latestPositions.length),
          idlePercent: percent(movement.idle, latestPositions.length),
          alarmPercent: percent(Number(alarmCount.count), totalLocks || 1),
        },
      },
      topAlarms: topAlarms.map((row) => ({
        type: row.type,
        count: Number(row.count),
      })),
      lockStateDistribution: {
        locked: lockState.locked,
        unlocked: lockState.unlocked,
        unknown: lockState.unknown,
      },
      rfidSyncStatus: syncRows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
    };
  }

  private async lockCounts(): Promise<KpiRow> {
    const rows = await this.dataSource.query<KpiRow[]>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'online')::text AS online,
        COUNT(*) FILTER (WHERE status = 'offline')::text AS offline,
        COUNT(*) FILTER (WHERE status = 'unknown')::text AS unknown
      FROM lock_devices
    `);

    return rows[0] ?? { total: '0', online: '0', offline: '0', unknown: '0' };
  }

  private async latestPositions(
    from: Date,
    to: Date,
  ): Promise<LatestPositionRow[]> {
    return this.dataSource.query<LatestPositionRow[]>(
      `
      SELECT DISTINCT ON ("terminalId")
        "terminalId",
        "speedKmh",
        "isLocked"
      FROM lock_positions
      WHERE "deletedAt" IS NULL
        AND "recordedAt" >= $1
        AND "recordedAt" <= $2
      ORDER BY "terminalId", "recordedAt" DESC
    `,
      [from, to],
    );
  }

  private async alarmCount(from: Date, to: Date): Promise<CountRow> {
    const rows = await this.dataSource.query<CountRow[]>(
      `
        SELECT COUNT(*)::text AS count
        FROM lock_events
        WHERE "deletedAt" IS NULL
          AND "occurredAt" >= $1
          AND "occurredAt" <= $2
          AND type NOT IN ('locked', 'unlocked')
      `,
      [from, to],
    );

    return rows[0] ?? { count: '0' };
  }

  private async activity(from: Date, to: Date): Promise<ActivityRow[]> {
    return this.dataSource.query<ActivityRow[]>(
      `
        SELECT
          DATE_TRUNC('day', "recordedAt")::date::text AS day,
          COUNT(*) FILTER (WHERE COALESCE("speedKmh", 0) > 0)::text AS moving,
          COUNT(*) FILTER (WHERE COALESCE("speedKmh", 0) <= 0)::text AS idle
        FROM lock_positions
        WHERE "deletedAt" IS NULL
          AND "recordedAt" >= $1
          AND "recordedAt" <= $2
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [from, to],
    );
  }

  private async topAlarms(from: Date, to: Date): Promise<AlarmRow[]> {
    return this.dataSource.query<AlarmRow[]>(
      `
        SELECT type, COUNT(*)::text AS count
        FROM lock_events
        WHERE "deletedAt" IS NULL
          AND "occurredAt" >= $1
          AND "occurredAt" <= $2
          AND type NOT IN ('locked', 'unlocked')
        GROUP BY type
        ORDER BY COUNT(*) DESC, type ASC
        LIMIT 5
      `,
      [from, to],
    );
  }

  private async rfidSyncStatus(): Promise<SyncRow[]> {
    return this.dataSource.query<SyncRow[]>(`
      SELECT "lastSyncStatus" AS status, COUNT(*)::text AS count
      FROM rfid_cards
      WHERE active = true
      GROUP BY "lastSyncStatus"
      ORDER BY "lastSyncStatus" ASC
    `);
  }
}

function dateRange(query: DashboardQueryDto): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : daysBefore(to, 7);

  if (from > to) {
    throw new BadRequestException('Dashboard from date must be before to date');
  }

  return { from, to };
}

function daysBefore(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function movementCounts(rows: LatestPositionRow[]) {
  return rows.reduce(
    (summary, row) => {
      if ((row.speedKmh ?? 0) > 0) {
        summary.moving += 1;
      } else {
        summary.idle += 1;
      }

      return summary;
    },
    { moving: 0, idle: 0 },
  );
}

function lockStateCounts(rows: LatestPositionRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.isLocked === true) {
        summary.locked += 1;
      } else if (row.isLocked === false) {
        summary.unlocked += 1;
      } else {
        summary.unknown += 1;
      }

      return summary;
    },
    { locked: 0, unlocked: 0, unknown: 0 },
  );
}

function fillActivityDays(from: Date, to: Date, rows: ActivityRow[]) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days: Array<{ day: string; moving: number; idle: number }> = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    const row = byDay.get(day);
    days.push({
      day,
      moving: row ? Number(row.moving) : 0,
      idle: row ? Number(row.idle) : 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function percent(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

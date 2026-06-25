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

type DashboardSnapshotRow = KpiRow & {
  latestPositions: LatestPositionRow[];
  alarmCount: string;
  activityRows: ActivityRow[];
  topAlarms: AlarmRow[];
  syncRows: SyncRow[];
};

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(query: DashboardQueryDto) {
    const { from, to } = dateRange(query);
    const terminalId = query.terminalId?.toUpperCase() ?? null;
    const snapshot = await this.dashboardSnapshot(from, to, terminalId);
    const lockCounts = snapshot;
    const latestPositions = snapshot.latestPositions;
    const alarmCount = { count: snapshot.alarmCount };
    const activityRows = snapshot.activityRows;
    const topAlarms = snapshot.topAlarms;
    const syncRows = snapshot.syncRows;
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
      filters: { terminalId },
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

  private async dashboardSnapshot(
    from: Date,
    to: Date,
    terminalId: string | null,
  ): Promise<DashboardSnapshotRow> {
    const terminalFilter = terminalId ? `AND "terminalId" = $3` : '';
    const lockFilter = terminalId ? `WHERE "terminalId" = $3` : '';
    const cardFilter = terminalId ? `AND lock."terminalId" = $3` : '';
    const rows = await this.dataSource.query<DashboardSnapshotRow[]>(
      `
        WITH filtered_positions AS MATERIALIZED (
          SELECT "terminalId", "speedKmh", "isLocked", "recordedAt"
          FROM lock_positions
          WHERE "deletedAt" IS NULL
            AND "recordedAt" >= $1
            AND "recordedAt" <= $2
            ${terminalFilter}
        ),
        ranked_positions AS (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY "terminalId" ORDER BY "recordedAt" DESC
            ) AS row_number
          FROM filtered_positions
        ),
        activity_rows AS (
          SELECT
            DATE_TRUNC('day', "recordedAt")::date::text AS day,
            COUNT(*) FILTER (
              WHERE COALESCE("speedKmh", 0) > 0
            )::int AS moving,
            COUNT(*) FILTER (
              WHERE COALESCE("speedKmh", 0) <= 0
            )::int AS idle
          FROM filtered_positions
          GROUP BY 1
        ),
        filtered_alarms AS MATERIALIZED (
          SELECT type
          FROM lock_events
          WHERE "deletedAt" IS NULL
            AND "occurredAt" >= $1
            AND "occurredAt" <= $2
            ${terminalFilter}
            AND type NOT IN ('locked', 'unlocked')
        ),
        top_alarm_rows AS (
          SELECT type, COUNT(*)::int AS count
          FROM filtered_alarms
          GROUP BY type
          ORDER BY COUNT(*) DESC, type ASC
          LIMIT 5
        ),
        lock_counts AS (
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'online')::text AS online,
            COUNT(*) FILTER (WHERE status = 'offline')::text AS offline,
            COUNT(*) FILTER (WHERE status = 'unknown')::text AS unknown
          FROM lock_devices
          ${lockFilter}
        )
        SELECT
          lock_counts.total,
          lock_counts.online,
          lock_counts.offline,
          lock_counts.unknown,
          COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'terminalId', "terminalId",
                'speedKmh', "speedKmh",
                'isLocked', "isLocked"
              )
              ORDER BY "terminalId"
            )
            FROM ranked_positions
            WHERE row_number = 1
          ), '[]'::jsonb) AS "latestPositions",
          (SELECT COUNT(*)::text FROM filtered_alarms) AS "alarmCount",
          COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'day', day,
                'moving', moving,
                'idle', idle
              )
              ORDER BY day
            )
            FROM activity_rows
          ), '[]'::jsonb) AS "activityRows",
          COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT('type', type, 'count', count)
              ORDER BY count DESC, type
            )
            FROM top_alarm_rows
          ), '[]'::jsonb) AS "topAlarms",
          COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT('status', status, 'count', count)
              ORDER BY status
            )
            FROM (
              SELECT card."lastSyncStatus" AS status, COUNT(*)::int AS count
              FROM rfid_cards card
              JOIN lock_devices lock ON lock.id = card."lockDeviceId"
              WHERE card.active = true
                ${cardFilter}
              GROUP BY card."lastSyncStatus"
            ) sync_counts
          ), '[]'::jsonb) AS "syncRows"
        FROM lock_counts
      `,
      terminalId ? [from, to, terminalId] : [from, to],
    );

    return (
      rows[0] ?? {
        total: '0',
        online: '0',
        offline: '0',
        unknown: '0',
        latestPositions: [],
        alarmCount: '0',
        activityRows: [],
        topAlarms: [],
        syncRows: [],
      }
    );
  }

  private async lockCounts(terminalId: string | null): Promise<KpiRow> {
    const rows = await this.dataSource.query<KpiRow[]>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'online')::text AS online,
        COUNT(*) FILTER (WHERE status = 'offline')::text AS offline,
        COUNT(*) FILTER (WHERE status = 'unknown')::text AS unknown
      FROM lock_devices
      ${terminalId ? 'WHERE "terminalId" = $1' : ''}
    `,
      terminalId ? [terminalId] : [],
    );

    return rows[0] ?? { total: '0', online: '0', offline: '0', unknown: '0' };
  }

  private async latestPositions(
    from: Date,
    to: Date,
    terminalId: string | null,
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
        ${terminalId ? 'AND "terminalId" = $3' : ''}
      ORDER BY "terminalId", "recordedAt" DESC
    `,
      terminalId ? [from, to, terminalId] : [from, to],
    );
  }

  private async alarmCount(
    from: Date,
    to: Date,
    terminalId: string | null,
  ): Promise<CountRow> {
    const rows = await this.dataSource.query<CountRow[]>(
      `
        SELECT COUNT(*)::text AS count
        FROM lock_events
        WHERE "deletedAt" IS NULL
          AND "occurredAt" >= $1
          AND "occurredAt" <= $2
          ${terminalId ? 'AND "terminalId" = $3' : ''}
          AND type NOT IN ('locked', 'unlocked')
      `,
      terminalId ? [from, to, terminalId] : [from, to],
    );

    return rows[0] ?? { count: '0' };
  }

  private async activity(
    from: Date,
    to: Date,
    terminalId: string | null,
  ): Promise<ActivityRow[]> {
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
          ${terminalId ? 'AND "terminalId" = $3' : ''}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      terminalId ? [from, to, terminalId] : [from, to],
    );
  }

  private async topAlarms(
    from: Date,
    to: Date,
    terminalId: string | null,
  ): Promise<AlarmRow[]> {
    return this.dataSource.query<AlarmRow[]>(
      `
        SELECT type, COUNT(*)::text AS count
        FROM lock_events
        WHERE "deletedAt" IS NULL
          AND "occurredAt" >= $1
          AND "occurredAt" <= $2
          ${terminalId ? 'AND "terminalId" = $3' : ''}
          AND type NOT IN ('locked', 'unlocked')
        GROUP BY type
        ORDER BY COUNT(*) DESC, type ASC
        LIMIT 5
      `,
      terminalId ? [from, to, terminalId] : [from, to],
    );
  }

  private async rfidSyncStatus(terminalId: string | null): Promise<SyncRow[]> {
    return this.dataSource.query<SyncRow[]>(
      `
      SELECT "lastSyncStatus" AS status, COUNT(*)::text AS count
      FROM rfid_cards card
      ${terminalId ? 'JOIN lock_devices lock ON lock.id = card."lockDeviceId"' : ''}
      WHERE card.active = true
        ${terminalId ? 'AND lock."terminalId" = $1' : ''}
      GROUP BY "lastSyncStatus"
      ORDER BY "lastSyncStatus" ASC
    `,
      terminalId ? [terminalId] : [],
    );
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

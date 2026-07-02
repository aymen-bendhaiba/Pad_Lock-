import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TcpConnectionsService } from '../tcp/tcp-connections.service';
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
  status?: string | null;
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

type EventTypeRow = {
  type: string;
  count: string;
};

type SyncRow = {
  status: string;
  count: string;
};

type TopRfidCardRow = {
  cardNumber: string;
  label: string | null;
  role: string | null;
  uses: string;
};

type TripHeatmapRow = {
  name: string;
  locked: string;
  unlocked: string;
  total: string;
};

type DashboardSnapshotRow = KpiRow & {
  latestPositions: LatestPositionRow[];
  alarmCount: string;
  stoppedCount: string;
  unlockedCount: string;
  totalActivities: string;
  activityRows: ActivityRow[];
  eventTypeRows: EventTypeRow[];
  topAlarms: AlarmRow[];
  syncRows: SyncRow[];
  topRfidCards: TopRfidCardRow[];
  tripHeatmapRows: TripHeatmapRow[];
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tcpConnectionsService: TcpConnectionsService,
  ) {}

  async summary(query: DashboardQueryDto) {
    const { from, to } = dateRange(query);
    const terminalId = query.terminalId?.toUpperCase() ?? null;
    const connectedTerminalIds = this.tcpConnectionsService.terminalIds();
    const snapshot = await this.dashboardSnapshot(
      from,
      to,
      terminalId,
      connectedTerminalIds,
    );
    const lockCounts = snapshot;
    const latestPositions = snapshot.latestPositions;
    const alarmCount = { count: snapshot.alarmCount };
    const activityRows = snapshot.activityRows;
    const eventTypeRows = snapshot.eventTypeRows;
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
        totalActivities: Number(snapshot.totalActivities),
        summary: {
          alarms: Number(snapshot.alarmCount),
          stopped: Number(snapshot.stoppedCount),
          unlocked: Number(snapshot.unlockedCount),
        },
        ranking: eventTypeRows.map((row) => ({
          type: row.type,
          count: Number(row.count),
        })),
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
      topRfidCards: snapshot.topRfidCards.map((row) => ({
        cardNumber: row.cardNumber,
        label: row.label,
        role: row.role,
        uses: Number(row.uses),
      })),
      tripHeatmap: snapshot.tripHeatmapRows.map((row) => ({
        name: row.name,
        locked: Number(row.locked),
        unlocked: Number(row.unlocked),
        total: Number(row.total),
      })),
      heatMapTracks: snapshot.tripHeatmapRows.map((row) => ({
        location: row.name.replace(/^Demo\s+/i, ''),
        value: Number(row.total),
        city: row.name.replace(/^Demo\s+/i, ''),
        count: Number(row.total),
        place: row.name.replace(/^Demo\s+/i, ''),
        activity: Number(row.total),
        name: row.name.replace(/^Demo\s+/i, ''),
        events: Number(row.total),
      })),
    };
  }

  private async dashboardSnapshot(
    from: Date,
    to: Date,
    terminalId: string | null,
    connectedTerminalIds: string[],
  ): Promise<DashboardSnapshotRow> {
    const terminalFilter = terminalId ? `AND "terminalId" = $3` : '';
    const lockFilter = terminalId ? `WHERE "terminalId" = $3` : '';
    const cardFilter = terminalId ? `AND lock."terminalId" = $3` : '';
    const connectedIdsParameter = terminalId ? '$4' : '$3';
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
        filtered_events AS MATERIALIZED (
          SELECT type, "rfidCardNumber", geofences
          FROM lock_events
          WHERE "deletedAt" IS NULL
            AND "occurredAt" >= $1
            AND "occurredAt" <= $2
            ${terminalFilter}
        ),
        top_alarm_rows AS (
          SELECT type, COUNT(*)::int AS count
          FROM filtered_alarms
          GROUP BY type
          ORDER BY COUNT(*) DESC, type ASC
          LIMIT 5
        ),
        event_type_rows AS (
          SELECT type, COUNT(*)::int AS count
          FROM filtered_events
          GROUP BY type
          ORDER BY COUNT(*) DESC, type ASC
          LIMIT 6
        ),
        top_rfid_cards AS (
          SELECT
            event."rfidCardNumber" AS "cardNumber",
            MAX(card.label) AS label,
            MAX(card.role::text) AS role,
            COUNT(*)::int AS uses
          FROM filtered_events event
          LEFT JOIN rfid_cards card
            ON card."cardNumber" = event."rfidCardNumber"
          WHERE event."rfidCardNumber" IS NOT NULL
          GROUP BY event."rfidCardNumber"
          ORDER BY COUNT(*) DESC, event."rfidCardNumber" ASC
          LIMIT 6
        ),
        trip_heatmap_rows AS (
          SELECT
            COALESCE(site.name, 'Outside geofences') AS name,
            COUNT(*) FILTER (WHERE event.type = 'locked')::int AS locked,
            COUNT(*) FILTER (WHERE event.type = 'unlocked')::int AS unlocked,
            COUNT(*)::int AS total
          FROM filtered_events event
          LEFT JOIN LATERAL (
            SELECT value->>'name' AS name
            FROM JSONB_ARRAY_ELEMENTS(event.geofences) value
            LIMIT 1
          ) site ON TRUE
          WHERE event.type IN ('locked', 'unlocked')
          GROUP BY COALESCE(site.name, 'Outside geofences')
          ORDER BY COUNT(*) DESC, name ASC
          LIMIT 12
        ),
        lock_counts AS (
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (
              WHERE "terminalId" = ANY(${connectedIdsParameter}::text[])
            )::text AS online,
            COUNT(*) FILTER (
              WHERE NOT ("terminalId" = ANY(${connectedIdsParameter}::text[]))
            )::text AS offline,
            '0'::text AS unknown
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
                'terminalId', ranked_positions."terminalId",
                'speedKmh',
                  CASE
                    WHEN lock."terminalId" = ANY(${connectedIdsParameter}::text[])
                      THEN ranked_positions."speedKmh"
                    ELSE NULL
                  END,
                'isLocked',
                  CASE
                    WHEN lock."terminalId" = ANY(${connectedIdsParameter}::text[])
                      THEN ranked_positions."isLocked"
                    ELSE NULL
                  END,
                'status',
                  CASE
                    WHEN lock."terminalId" = ANY(${connectedIdsParameter}::text[])
                      THEN 'online'
                    ELSE 'offline'
                  END
              )
              ORDER BY ranked_positions."terminalId"
            )
            FROM ranked_positions
            JOIN lock_devices lock ON lock."terminalId" = ranked_positions."terminalId"
            WHERE row_number = 1
          ), '[]'::jsonb) AS "latestPositions",
          (SELECT COUNT(*)::text FROM filtered_alarms) AS "alarmCount",
          (SELECT COUNT(*)::text FROM filtered_events WHERE type = 'locked') AS "stoppedCount",
          (SELECT COUNT(*)::text FROM filtered_events WHERE type = 'unlocked') AS "unlockedCount",
          (SELECT COUNT(*)::text FROM filtered_events) AS "totalActivities",
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
            FROM event_type_rows
          ), '[]'::jsonb) AS "eventTypeRows",
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
          ,
          COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'cardNumber', "cardNumber",
                'label', label,
                'role', role,
                'uses', uses
              )
              ORDER BY uses DESC, "cardNumber"
            )
            FROM top_rfid_cards
          ), '[]'::jsonb) AS "topRfidCards",
          COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'name', name,
                'locked', locked,
                'unlocked', unlocked,
                'total', total
              )
              ORDER BY total DESC, name
            )
            FROM trip_heatmap_rows
          ), '[]'::jsonb) AS "tripHeatmapRows"
        FROM lock_counts
      `,
      terminalId
        ? [from, to, terminalId, connectedTerminalIds]
        : [from, to, connectedTerminalIds],
    );

    return (
      rows[0] ?? {
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
      if (row.status && row.status !== 'online') {
        return summary;
      }

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
      if (row.status && row.status !== 'online') {
        summary.unknown += 1;
      } else if (row.isLocked === true) {
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

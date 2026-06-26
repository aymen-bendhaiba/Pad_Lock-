import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AlertsReportQueryDto,
  BatteryReportQueryDto,
  GeofencesReportQueryDto,
  MileageReportQueryDto,
  ReportGroupBy,
  ReportQueryDto,
  ReportSummaryQueryDto,
  UnlockMethod,
  UnlocksReportQueryDto,
} from './dto/report-query.dto';

type SqlFilter = {
  clauses: string[];
  parameters: unknown[];
  add(value: unknown, sql: (placeholder: string) => string): void;
};

type ReportRow = Record<string, unknown>;
type CountGroupRow = { key: string; count: string };

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async alerts(query: AlertsReportQueryDto) {
    const context = reportContext(query);
    const filter = eventFilter(context, query);
    const where = filter.clauses.join(' AND ');
    const statisticsRows = await this.dataSource.query<
      Array<{
        total: string;
        unresolved: string;
        critical: string;
        affectedLocks: string;
        byType: CountGroupRow[];
        bySeverity: CountGroupRow[];
        byStatus: CountGroupRow[];
        timeline: ReportRow[];
        rows: ReportRow[];
      }>
    >(
      `WITH filtered_events AS MATERIALIZED (
             SELECT
               id,
               "terminalId",
               type,
               severity,
               status,
               source,
               "rfidCardNumber",
               latitude,
               longitude,
               geofences,
               "occurredAt",
               "receivedAt"
             FROM lock_events
             WHERE ${where}
           )
           SELECT
             COUNT(*)::text AS total,
             COUNT(*) FILTER (
               WHERE status <> 'resolve'
             )::text AS unresolved,
             COUNT(*) FILTER (
               WHERE severity = 'critical'
             )::text AS critical,
             COUNT(DISTINCT "terminalId")::text AS "affectedLocks",
             COALESCE((
               SELECT JSONB_AGG(
                 JSONB_BUILD_OBJECT('key', key, 'count', count)
                 ORDER BY count DESC, key
               )
               FROM (
                 SELECT type::text AS key, COUNT(*)::int AS count
                 FROM filtered_events
                 GROUP BY type
               ) grouped
             ), '[]'::jsonb) AS "byType",
             COALESCE((
               SELECT JSONB_AGG(
                 JSONB_BUILD_OBJECT('key', key, 'count', count)
                 ORDER BY count DESC, key
               )
               FROM (
                 SELECT severity::text AS key, COUNT(*)::int AS count
                 FROM filtered_events
                 GROUP BY severity
               ) grouped
             ), '[]'::jsonb) AS "bySeverity",
             COALESCE((
               SELECT JSONB_AGG(
                 JSONB_BUILD_OBJECT('key', key, 'count', count)
                 ORDER BY count DESC, key
               )
               FROM (
                 SELECT status::text AS key, COUNT(*)::int AS count
                 FROM filtered_events
                 GROUP BY status
               ) grouped
             ), '[]'::jsonb) AS "byStatus",
             COALESCE((
               SELECT JSONB_AGG(
                 JSONB_BUILD_OBJECT(
                   'bucket', bucket,
                   'total', total,
                   'critical', critical
                 )
                 ORDER BY bucket
               )
               FROM (
                 SELECT
                   DATE_TRUNC(
                     '${context.bucket}', "occurredAt"
                   ) AS bucket,
                   COUNT(*)::int AS total,
                   COUNT(*) FILTER (
                     WHERE severity = 'critical'
                   )::int AS critical
                 FROM filtered_events
                 GROUP BY 1
               ) grouped
             ), '[]'::jsonb) AS timeline
             ,
             COALESCE((
               SELECT JSONB_AGG(
                 TO_JSONB(page_rows)
                 ORDER BY page_rows."occurredAt" DESC
               )
               FROM (
                 SELECT
                   id,
                   "terminalId",
                   type,
                   severity,
                   status,
                   source,
                   "rfidCardNumber",
                   latitude,
                   longitude,
                   geofences,
                   "occurredAt",
                   "receivedAt"
                 FROM filtered_events
                 ORDER BY "occurredAt" DESC
                 LIMIT ${context.limit} OFFSET ${context.offset}
               ) page_rows
             ), '[]'::jsonb) AS rows
           FROM filtered_events`,
      filter.parameters,
    );
    const statistics = statisticsRows[0] ?? {
      total: '0',
      unresolved: '0',
      critical: '0',
      affectedLocks: '0',
      byType: [],
      bySeverity: [],
      byStatus: [],
      timeline: [],
      rows: [],
    };

    return reportResponse(context, {
      summary: {
        total: Number(statistics.total),
        unresolved: Number(statistics.unresolved),
        critical: Number(statistics.critical),
        affectedLocks: Number(statistics.affectedLocks),
        byType: numericCounts(statistics.byType),
        bySeverity: numericCounts(statistics.bySeverity),
        byStatus: numericCounts(statistics.byStatus),
      },
      timeline: statistics.timeline,
      rows: statistics.rows,
      total: Number(statistics.total),
      filters: {
        type: query.type ?? null,
        severity: query.severity ?? null,
        status: query.status ?? null,
      },
    });
  }

  async geofences(query: GeofencesReportQueryDto) {
    const context = reportContext(query);
    const baseParameters: unknown[] = [context.from, context.to];
    const transitionClauses = [
      `t."deletedAt" IS NULL`,
      `t."occurredAt" >= $1`,
      `t."occurredAt" <= $2`,
    ];
    const eventClauses = [
      `e."deletedAt" IS NULL`,
      `e.type = 'unlocked'`,
      `e."occurredAt" >= $1`,
      `e."occurredAt" <= $2`,
    ];
    const geofenceClauses: string[] = [];

    if (context.terminalId) {
      baseParameters.push(context.terminalId);
      const placeholder = `$${baseParameters.length}`;
      transitionClauses.push(`t."terminalId" = ${placeholder}`);
      eventClauses.push(`e."terminalId" = ${placeholder}`);
    }
    if (query.geofenceId) {
      baseParameters.push(query.geofenceId);
      const placeholder = `$${baseParameters.length}`;
      transitionClauses.push(`t."geofenceId" = ${placeholder}::uuid`);
      eventClauses.push(
        `e.geofences @> jsonb_build_array(jsonb_build_object('id', ${placeholder}::text))`,
      );
      geofenceClauses.push(`g.id = ${placeholder}::uuid`);
    }
    const transitionWhere = transitionClauses.join(' AND ');
    const eventWhere = eventClauses.join(' AND ');
    const geofenceWhere =
      geofenceClauses.length > 0 ? geofenceClauses.join(' AND ') : 'TRUE';
    const limitPlaceholder = `$${baseParameters.length + 1}`;
    const offsetPlaceholder = `$${baseParameters.length + 2}`;
    const paginatedParameters: unknown[] = [
      ...baseParameters,
      context.limit,
      context.offset,
    ];
    const [summaryRows, timeline, rows, countRows] = await Promise.all([
      this.dataSource.query<
        Array<{
          totalGeofences: string;
          entries: string;
          exits: string;
          unlocksInside: string;
          affectedLocks: string;
        }>
      >(
        `SELECT
           (SELECT COUNT(*) FROM geofences g
             WHERE ${geofenceWhere})::text
             AS "totalGeofences",
           COUNT(*) FILTER (WHERE t.type = 'enter')::text AS entries,
           COUNT(*) FILTER (WHERE t.type = 'exit')::text AS exits,
           (SELECT COUNT(*) FROM lock_events e
             WHERE ${eventWhere})::text AS "unlocksInside",
           COUNT(DISTINCT t."terminalId")::text AS "affectedLocks"
         FROM geofence_transitions t
         WHERE ${transitionWhere}`,
        baseParameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `SELECT
           DATE_TRUNC('${context.bucket}', t."occurredAt") AS bucket,
           COUNT(*) FILTER (WHERE t.type = 'enter')::int AS entries,
           COUNT(*) FILTER (WHERE t.type = 'exit')::int AS exits
         FROM geofence_transitions t
         WHERE ${transitionWhere}
         GROUP BY 1
         ORDER BY 1`,
        baseParameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `SELECT
           g.id, g.name, g."shapeType", g."accessMode", g.rules,
           g."geoBoundaryId", g."createdAt",
           COUNT(t.id) FILTER (WHERE t.type = 'enter')::int AS entries,
           COUNT(t.id) FILTER (WHERE t.type = 'exit')::int AS exits,
           COUNT(DISTINCT t."terminalId")::int AS "affectedLocks",
           (SELECT COUNT(*) FROM lock_events e
             WHERE ${eventWhere}
               AND e.geofences @> jsonb_build_array(
                 jsonb_build_object('id', g.id::text)
               ))::int AS "unlocksInside"
         FROM geofences g
         LEFT JOIN geofence_transitions t
           ON t."geofenceId" = g.id
          AND t."deletedAt" IS NULL
          AND t."occurredAt" >= $1
          AND t."occurredAt" <= $2
          ${context.terminalId ? `AND t."terminalId" = $3` : ''}
         WHERE ${geofenceWhere}
         GROUP BY g.id
         ORDER BY g.name
         LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
        paginatedParameters,
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count
         FROM geofences g
         WHERE ${query.geofenceId ? 'g.id = $1::uuid' : 'TRUE'}`,
        query.geofenceId ? [query.geofenceId] : [],
      ),
    ]);
    const summary = summaryRows[0] ?? {
      totalGeofences: '0',
      entries: '0',
      exits: '0',
      unlocksInside: '0',
      affectedLocks: '0',
    };

    return reportResponse(context, {
      summary: {
        totalGeofences: Number(summary.totalGeofences),
        entries: Number(summary.entries),
        exits: Number(summary.exits),
        unlocksInside: Number(summary.unlocksInside),
        affectedLocks: Number(summary.affectedLocks),
      },
      timeline,
      rows,
      total: Number(countRows[0]?.count ?? 0),
      filters: { geofenceId: query.geofenceId ?? null },
    });
  }

  async unlocks(query: UnlocksReportQueryDto) {
    const context = reportContext(query);
    const filter = eventFilter(context, {});
    filter.clauses.push(`type = 'unlocked'`);
    if (query.method) {
      filter.add(query.method, (p) => `${unlockMethodSql('source')} = ${p}`);
    }
    if (query.geofenceId) {
      filter.add(
        query.geofenceId,
        (p) =>
          `geofences @> jsonb_build_array(jsonb_build_object('id', ${p}::text))`,
      );
    }
    const where = filter.clauses.join(' AND ');
    const [summaryRows, methodRows, timeline, rows] = await Promise.all([
      this.dataSource.query<
        Array<{
          total: string;
          insideSite: string;
          byCard: string;
          byPassword: string;
          affectedLocks: string;
        }>
      >(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE jsonb_array_length(geofences) > 0)::text AS "insideSite",
           COUNT(*) FILTER (WHERE ${unlockMethodSql('source')} = 'rfid')::text AS "byCard",
           COUNT(*) FILTER (WHERE ${unlockMethodSql('source')} IN ('static_password', 'dynamic_password'))::text AS "byPassword",
           COUNT(DISTINCT "terminalId")::text AS "affectedLocks"
         FROM lock_events
         WHERE ${where}`,
        filter.parameters,
      ),
      this.dataSource.query<CountGroupRow[]>(
        `SELECT ${unlockMethodSql('source')} AS key, COUNT(*)::text AS count
         FROM lock_events
         WHERE ${where}
         GROUP BY 1
         ORDER BY COUNT(*) DESC`,
        filter.parameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `SELECT
           DATE_TRUNC('${context.bucket}', "occurredAt") AS bucket,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE jsonb_array_length(geofences) > 0)::int AS "insideSite",
           COUNT(*) FILTER (WHERE ${unlockMethodSql('source')} = 'rfid')::int AS rfid,
           COUNT(*) FILTER (WHERE ${unlockMethodSql('source')} IN ('static_password', 'dynamic_password'))::int AS password
         FROM lock_events
         WHERE ${where}
         GROUP BY 1
         ORDER BY 1`,
        filter.parameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `SELECT id, "terminalId", source,
                ${unlockMethodSql('source')} AS method,
                "rfidCardNumber", latitude, longitude, geofences,
                "occurredAt"
         FROM lock_events
         WHERE ${where}
         ORDER BY "occurredAt" DESC
         LIMIT ${context.limit} OFFSET ${context.offset}`,
        filter.parameters,
      ),
    ]);
    const summary = summaryRows[0] ?? {
      total: '0',
      insideSite: '0',
      byCard: '0',
      byPassword: '0',
      affectedLocks: '0',
    };

    return reportResponse(context, {
      summary: {
        totalOpened: Number(summary.total),
        openedInsideSite: Number(summary.insideSite),
        openedByCard: Number(summary.byCard),
        openedByPassword: Number(summary.byPassword),
        affectedLocks: Number(summary.affectedLocks),
        byMethod: numericCounts(methodRows),
      },
      timeline,
      rows,
      total: Number(summary.total),
      filters: {
        geofenceId: query.geofenceId ?? null,
        method: query.method ?? null,
      },
    });
  }

  async mileage(query: MileageReportQueryDto) {
    const context = reportContext(query);
    const hasTerminalId = Boolean(context.terminalId);
    // cteParameters matches the number of $N placeholders the CTE actually uses:
    // - no terminalId filter → only $1 (from) and $2 (to)
    // - with terminalId filter → $1, $2, and $3
    const cteParameters: unknown[] = hasTerminalId
      ? [context.from, context.to, context.terminalId]
      : [context.from, context.to];
    const paginatedParameters: unknown[] = [
      ...cteParameters,
      context.limit,
      context.offset,
    ];
    const cte = mileageCte(hasTerminalId);
    // Determine the positional indices for LIMIT/OFFSET based on cteParameters length
    const limitIdx = cteParameters.length + 1;
    const offsetIdx = cteParameters.length + 2;
    const [summaryRows, timeline, rows, countRows] = await Promise.all([
      this.dataSource.query<
        Array<{
          totalKilometers: string;
          affectedLocks: string;
          movingSamples: string;
        }>
      >(
        `${cte}
         SELECT
           COALESCE(SUM(delta), 0)::text AS "totalKilometers",
           COUNT(DISTINCT "terminalId") FILTER (WHERE delta > 0)::text AS "affectedLocks",
           COUNT(*) FILTER (WHERE delta > 0)::text AS "movingSamples"
         FROM deltas`,
        cteParameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `${cte}
         SELECT DATE_TRUNC('${context.bucket}', "recordedAt") AS bucket,
                ROUND(SUM(delta)::numeric, 3)::float AS kilometers
         FROM deltas
         GROUP BY 1
         ORDER BY 1`,
        cteParameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `${cte}
         SELECT "terminalId",
                MIN(mileage) FILTER (WHERE "recordedAt" >= $1)::int AS "startMileage",
                MAX(mileage) FILTER (WHERE "recordedAt" >= $1)::int AS "endMileage",
                ROUND(SUM(delta)::numeric, 3)::float AS kilometers,
                MIN("recordedAt") FILTER (WHERE "recordedAt" >= $1) AS "firstRecordedAt",
                MAX("recordedAt") AS "lastRecordedAt"
         FROM deltas
         GROUP BY "terminalId"
         ORDER BY kilometers DESC, "terminalId"
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        paginatedParameters,
      ),
      hasTerminalId
        ? this.dataSource.query<Array<{ count: string }>>(
            `SELECT COUNT(DISTINCT "terminalId")::text AS count
             FROM lock_positions
             WHERE "deletedAt" IS NULL
               AND mileage IS NOT NULL
               AND "recordedAt" >= $1 AND "recordedAt" <= $2
               AND "terminalId" = $3`,
            cteParameters,
          )
        : this.dataSource.query<Array<{ count: string }>>(
            `SELECT COUNT(DISTINCT "terminalId")::text AS count
             FROM lock_positions
             WHERE "deletedAt" IS NULL
               AND mileage IS NOT NULL
               AND "recordedAt" >= $1 AND "recordedAt" <= $2`,
            cteParameters,
          ),
    ]);
    const summary = summaryRows[0] ?? {
      totalKilometers: '0',
      affectedLocks: '0',
      movingSamples: '0',
    };

    return reportResponse(context, {
      summary: {
        totalKilometers: Number(summary.totalKilometers),
        affectedLocks: Number(summary.affectedLocks),
        movingSamples: Number(summary.movingSamples),
      },
      timeline,
      rows,
      total: Number(countRows[0]?.count ?? 0),
    });
  }

  async battery(query: BatteryReportQueryDto) {
    const context = reportContext(query);
    const filter = positionFilter(context);
    if (query.below !== undefined) {
      filter.add(query.below, (p) => `"batteryPercentage" <= ${p}`);
    }
    const where = filter.clauses.join(' AND ');
    const [summaryRows, timeline, rows, countRows] = await Promise.all([
      this.dataSource.query<
        Array<{
          samples: string;
          average: string | null;
          minimum: string | null;
          maximum: string | null;
          lowSamples: string;
          chargingSamples: string;
          affectedLocks: string;
        }>
      >(
        `SELECT
           COUNT(*)::text AS samples,
           ROUND(AVG("batteryPercentage"), 2)::text AS average,
           MIN("batteryPercentage")::text AS minimum,
           MAX("batteryPercentage")::text AS maximum,
           COUNT(*) FILTER (WHERE "batteryPercentage" <= 30)::text AS "lowSamples",
           COUNT(*) FILTER (WHERE "isCharging")::text AS "chargingSamples",
           COUNT(DISTINCT "terminalId")::text AS "affectedLocks"
         FROM lock_positions
         WHERE ${where}`,
        filter.parameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `SELECT
           DATE_TRUNC('${context.bucket}', "recordedAt") AS bucket,
           ROUND(AVG("batteryPercentage"), 2)::float AS average,
           MIN("batteryPercentage")::int AS minimum,
           MAX("batteryPercentage")::int AS maximum
         FROM lock_positions
         WHERE ${where}
         GROUP BY 1
         ORDER BY 1`,
        filter.parameters,
      ),
      this.dataSource.query<ReportRow[]>(
        `SELECT "terminalId",
                ROUND(AVG("batteryPercentage"), 2)::float AS average,
                MIN("batteryPercentage")::int AS minimum,
                MAX("batteryPercentage")::int AS maximum,
                (ARRAY_AGG("batteryPercentage" ORDER BY "recordedAt" DESC))[1]::int AS latest,
                (ARRAY_AGG("isCharging" ORDER BY "recordedAt" DESC))[1] AS "isCharging",
                MAX("recordedAt") AS "lastRecordedAt"
         FROM lock_positions
         WHERE ${where}
         GROUP BY "terminalId"
         ORDER BY minimum ASC, "terminalId"
         LIMIT ${context.limit} OFFSET ${context.offset}`,
        filter.parameters,
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(DISTINCT "terminalId")::text AS count
         FROM lock_positions
         WHERE ${where}`,
        filter.parameters,
      ),
    ]);
    const summary = summaryRows[0] ?? {
      samples: '0',
      average: null,
      minimum: null,
      maximum: null,
      lowSamples: '0',
      chargingSamples: '0',
      affectedLocks: '0',
    };

    return reportResponse(context, {
      summary: {
        samples: Number(summary.samples),
        averagePercentage:
          summary.average === null ? null : Number(summary.average),
        minimumPercentage:
          summary.minimum === null ? null : Number(summary.minimum),
        maximumPercentage:
          summary.maximum === null ? null : Number(summary.maximum),
        lowSamples: Number(summary.lowSamples),
        chargingSamples: Number(summary.chargingSamples),
        affectedLocks: Number(summary.affectedLocks),
      },
      timeline,
      rows,
      total: Number(countRows[0]?.count ?? 0),
      filters: { below: query.below ?? null },
    });
  }
  /**
   * Lightweight summary endpoint — runs one scalar query per report type in
   * parallel and returns all summaries in a single response. No timeline or
   * paginated rows are included, making this much cheaper than calling each
   * individual report endpoint.
   */
  async summary(query: ReportSummaryQueryDto) {
    const context = reportContext(query as ReportQueryDto);

    // ── Alerts ──────────────────────────────────────────────────────────────
    const alertFilter = eventFilter(context, {});
    const alertWhere = alertFilter.clauses.join(' AND ');

    // ── Unlocks ─────────────────────────────────────────────────────────────
    const unlockFilter = eventFilter(context, {});
    unlockFilter.clauses.push(`type = 'unlocked'`);
    const unlockWhere = unlockFilter.clauses.join(' AND ');

    // ── Geofences ───────────────────────────────────────────────────────────
    const geoBaseParams: unknown[] = [context.from, context.to];
    const transitionClauses = [
      `t."deletedAt" IS NULL`,
      `t."occurredAt" >= $1`,
      `t."occurredAt" <= $2`,
    ];
    const eventClauses = [
      `e."deletedAt" IS NULL`,
      `e.type = 'unlocked'`,
      `e."occurredAt" >= $1`,
      `e."occurredAt" <= $2`,
    ];
    if (context.terminalId) {
      geoBaseParams.push(context.terminalId);
      const ph = `$${geoBaseParams.length}`;
      transitionClauses.push(`t."terminalId" = ${ph}`);
      eventClauses.push(`e."terminalId" = ${ph}`);
    }
    const transitionWhere = transitionClauses.join(' AND ');
    const geoEventWhere = eventClauses.join(' AND ');

    // ── Battery ─────────────────────────────────────────────────────────────
    const batteryFilter = positionFilter(context);
    const batteryWhere = batteryFilter.clauses.join(' AND ');

    // ── Mileage ─────────────────────────────────────────────────────────────
    const hasTerminalId = Boolean(context.terminalId);
    const milParams: unknown[] = hasTerminalId
      ? [context.from, context.to, context.terminalId]
      : [context.from, context.to];
    const cte = mileageCte(hasTerminalId);

    const [alertRows, unlockRows, geoRows, batteryRows, mileageRows] =
      await Promise.all([
        this.dataSource.query<
          Array<{
            total: string;
            unresolved: string;
            critical: string;
            affectedLocks: string;
          }>
        >(
          `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE status <> 'resolve')::text AS unresolved,
           COUNT(*) FILTER (WHERE severity = 'critical')::text AS critical,
           COUNT(DISTINCT "terminalId")::text AS "affectedLocks"
         FROM lock_events
         WHERE ${alertWhere}`,
          alertFilter.parameters,
        ),
        this.dataSource.query<
          Array<{
            total: string;
            insideSite: string;
            byCard: string;
            byPassword: string;
            affectedLocks: string;
          }>
        >(
          `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE jsonb_array_length(geofences) > 0)::text AS "insideSite",
           COUNT(*) FILTER (WHERE ${unlockMethodSql('source')} = 'rfid')::text AS "byCard",
           COUNT(*) FILTER (WHERE ${unlockMethodSql('source')} IN ('static_password', 'dynamic_password'))::text AS "byPassword",
           COUNT(DISTINCT "terminalId")::text AS "affectedLocks"
         FROM lock_events
         WHERE ${unlockWhere}`,
          unlockFilter.parameters,
        ),
        this.dataSource.query<
          Array<{
            totalGeofences: string;
            entries: string;
            exits: string;
            unlocksInside: string;
            affectedLocks: string;
          }>
        >(
          `SELECT
           (SELECT COUNT(*) FROM geofences)::text AS "totalGeofences",
           COUNT(*) FILTER (WHERE t.type = 'enter')::text AS entries,
           COUNT(*) FILTER (WHERE t.type = 'exit')::text AS exits,
           (SELECT COUNT(*) FROM lock_events e WHERE ${geoEventWhere})::text AS "unlocksInside",
           COUNT(DISTINCT t."terminalId")::text AS "affectedLocks"
         FROM geofence_transitions t
         WHERE ${transitionWhere}`,
          geoBaseParams,
        ),
        this.dataSource.query<
          Array<{
            samples: string;
            average: string | null;
            minimum: string | null;
            maximum: string | null;
            lowSamples: string;
            chargingSamples: string;
            affectedLocks: string;
          }>
        >(
          `SELECT
           COUNT(*)::text AS samples,
           ROUND(AVG("batteryPercentage"), 2)::text AS average,
           MIN("batteryPercentage")::text AS minimum,
           MAX("batteryPercentage")::text AS maximum,
           COUNT(*) FILTER (WHERE "batteryPercentage" <= 30)::text AS "lowSamples",
           COUNT(*) FILTER (WHERE "isCharging")::text AS "chargingSamples",
           COUNT(DISTINCT "terminalId")::text AS "affectedLocks"
         FROM lock_positions
         WHERE ${batteryWhere}`,
          batteryFilter.parameters,
        ),
        this.dataSource.query<
          Array<{
            totalKilometers: string;
            affectedLocks: string;
            movingSamples: string;
          }>
        >(
          `${cte}
         SELECT
           COALESCE(SUM(delta), 0)::text AS "totalKilometers",
           COUNT(DISTINCT "terminalId") FILTER (WHERE delta > 0)::text AS "affectedLocks",
           COUNT(*) FILTER (WHERE delta > 0)::text AS "movingSamples"
         FROM deltas`,
          milParams,
        ),
      ]);

    const alerts = alertRows[0] ?? {
      total: '0',
      unresolved: '0',
      critical: '0',
      affectedLocks: '0',
    };
    const unlocks = unlockRows[0] ?? {
      total: '0',
      insideSite: '0',
      byCard: '0',
      byPassword: '0',
      affectedLocks: '0',
    };
    const geo = geoRows[0] ?? {
      totalGeofences: '0',
      entries: '0',
      exits: '0',
      unlocksInside: '0',
      affectedLocks: '0',
    };
    const battery = batteryRows[0] ?? {
      samples: '0',
      average: null,
      minimum: null,
      maximum: null,
      lowSamples: '0',
      chargingSamples: '0',
      affectedLocks: '0',
    };
    const mileage = mileageRows[0] ?? {
      totalKilometers: '0',
      affectedLocks: '0',
      movingSamples: '0',
    };

    return {
      range: {
        from: context.from.toISOString(),
        to: context.to.toISOString(),
        groupBy: context.groupBy,
      },
      filters: { terminalId: context.terminalId },
      reports: {
        alerts: {
          total: Number(alerts.total),
          unresolved: Number(alerts.unresolved),
          critical: Number(alerts.critical),
          affectedLocks: Number(alerts.affectedLocks),
        },
        unlocks: {
          totalOpened: Number(unlocks.total),
          openedInsideSite: Number(unlocks.insideSite),
          openedByCard: Number(unlocks.byCard),
          openedByPassword: Number(unlocks.byPassword),
          affectedLocks: Number(unlocks.affectedLocks),
        },
        geofences: {
          totalGeofences: Number(geo.totalGeofences),
          entries: Number(geo.entries),
          exits: Number(geo.exits),
          unlocksInside: Number(geo.unlocksInside),
          affectedLocks: Number(geo.affectedLocks),
        },
        battery: {
          samples: Number(battery.samples),
          averagePercentage:
            battery.average === null ? null : Number(battery.average),
          minimumPercentage:
            battery.minimum === null ? null : Number(battery.minimum),
          maximumPercentage:
            battery.maximum === null ? null : Number(battery.maximum),
          lowSamples: Number(battery.lowSamples),
          chargingSamples: Number(battery.chargingSamples),
          affectedLocks: Number(battery.affectedLocks),
        },
        mileage: {
          totalKilometers: Number(mileage.totalKilometers),
          affectedLocks: Number(mileage.affectedLocks),
          movingSamples: Number(mileage.movingSamples),
        },
      },
    };
  }
}

function reportContext(query: ReportQueryDto) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : daysBefore(to, 30);

  if (from > to) {
    throw new BadRequestException('Report from date must be before to date');
  }

  return {
    from,
    to,
    terminalId: query.terminalId?.toUpperCase() ?? null,
    groupBy: query.groupBy ?? ReportGroupBy.Day,
    bucket: bucketFor(query.groupBy ?? ReportGroupBy.Day),
    page: query.page ?? 1,
    limit: query.limit ?? 50,
    offset: ((query.page ?? 1) - 1) * (query.limit ?? 50),
  };
}

function eventFilter(
  context: ReturnType<typeof reportContext>,
  query: Partial<AlertsReportQueryDto>,
): SqlFilter {
  const filter = sqlFilter();
  filter.clauses.push(`"deletedAt" IS NULL`);
  filter.add(context.from, (p) => `"occurredAt" >= ${p}`);
  filter.add(context.to, (p) => `"occurredAt" <= ${p}`);
  if (context.terminalId) {
    filter.add(context.terminalId, (p) => `"terminalId" = ${p}`);
  }
  if (query.type) filter.add(query.type, (p) => `type = ${p}`);
  if (query.severity) filter.add(query.severity, (p) => `severity = ${p}`);
  if (query.status) filter.add(query.status, (p) => `status = ${p}`);
  return filter;
}

function positionFilter(context: ReturnType<typeof reportContext>): SqlFilter {
  const filter = sqlFilter();
  filter.clauses.push(`"deletedAt" IS NULL`, `"batteryPercentage" IS NOT NULL`);
  filter.add(context.from, (p) => `"recordedAt" >= ${p}`);
  filter.add(context.to, (p) => `"recordedAt" <= ${p}`);
  if (context.terminalId) {
    filter.add(context.terminalId, (p) => `"terminalId" = ${p}`);
  }
  return filter;
}

function sqlFilter(): SqlFilter {
  const clauses: string[] = [];
  const parameters: unknown[] = [];
  const filter: SqlFilter = {
    clauses,
    parameters,
    add(value, sql) {
      parameters.push(value);
      clauses.push(sql(`$${parameters.length}`));
    },
  };
  return filter;
}

function reportResponse(
  context: ReturnType<typeof reportContext>,
  result: {
    summary: unknown;
    timeline: unknown[];
    rows: unknown[];
    total: number;
    filters?: Record<string, unknown>;
  },
) {
  return {
    range: {
      from: context.from.toISOString(),
      to: context.to.toISOString(),
      groupBy: context.groupBy,
    },
    filters: {
      terminalId: context.terminalId,
      ...(result.filters ?? {}),
    },
    summary: result.summary,
    timeline: result.timeline,
    pagination: {
      page: context.page,
      limit: context.limit,
      total: result.total,
      pages: result.total === 0 ? 0 : Math.ceil(result.total / context.limit),
    },
    rows: result.rows,
  };
}

function numericCounts(rows: Array<{ key: string; count: string }>) {
  return rows.map((row) => ({ key: row.key, count: Number(row.count) }));
}

function bucketFor(groupBy: ReportGroupBy): 'day' | 'week' | 'month' {
  return groupBy;
}

function daysBefore(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function unlockMethodSql(column: string): string {
  return `CASE
    WHEN ${column} = 'Swipe RFID card' THEN '${UnlockMethod.Rfid}'
    WHEN ${column} = 'Remote static password unlock' THEN '${UnlockMethod.StaticPassword}'
    WHEN ${column} = 'Remote dynamic password unlock' THEN '${UnlockMethod.DynamicPassword}'
    WHEN ${column} = 'Bluetooth unlock' THEN '${UnlockMethod.Bluetooth}'
    ELSE '${UnlockMethod.Other}'
  END`;
}

function mileageCte(hasTerminalId: boolean): string {
  const terminalCondition = hasTerminalId ? `AND "terminalId" = $3` : '';

  return `
    WITH baseline AS (
      SELECT DISTINCT ON ("terminalId")
        "terminalId", mileage, "recordedAt"
      FROM lock_positions
      WHERE "deletedAt" IS NULL
        AND mileage IS NOT NULL
        AND "recordedAt" < $1
        ${terminalCondition}
      ORDER BY "terminalId", "recordedAt" DESC
    ),
    samples AS (
      SELECT "terminalId", mileage, "recordedAt" FROM baseline
      UNION ALL
      SELECT "terminalId", mileage, "recordedAt"
      FROM lock_positions
      WHERE "deletedAt" IS NULL
        AND mileage IS NOT NULL
        AND "recordedAt" >= $1 AND "recordedAt" <= $2
        ${terminalCondition}
    ),
    ordered AS (
      SELECT *, LAG(mileage) OVER (
        PARTITION BY "terminalId" ORDER BY "recordedAt"
      ) AS previous
      FROM samples
    ),
    deltas AS (
      SELECT *,
        CASE
          WHEN "recordedAt" < $1 OR previous IS NULL OR mileage < previous THEN 0
          ELSE mileage - previous
        END::float AS delta
      FROM ordered
      WHERE "recordedAt" >= $1
    )`;
}

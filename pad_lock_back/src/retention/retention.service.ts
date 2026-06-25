import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Pool } from 'pg';
import { Between, IsNull, LessThan, Repository } from 'typeorm';
import { LockEvent } from '../lock-events/lock-event.entity';
import { LockPosition } from '../positions/lock-position.entity';
import { GeofenceTransition } from '../geofences/geofence-transition.entity';

type RetentionEntity = LockEvent | LockPosition | GeofenceTransition;

type RetentionJobConfig<T extends RetentionEntity> = {
  repository: Repository<T>;
  tableName: 'lock_events' | 'lock_positions' | 'geofence_transitions';
  timestampColumn: 'occurredAt' | 'recordedAt';
};

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private archivePool: Pool | null = null;
  private archiveReady = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(LockEvent)
    private readonly lockEventsRepository: Repository<LockEvent>,
    @InjectRepository(LockPosition)
    private readonly lockPositionsRepository: Repository<LockPosition>,
    @InjectRepository(GeofenceTransition)
    private readonly geofenceTransitionsRepository: Repository<GeofenceTransition>,
  ) {}

  async onModuleInit(): Promise<void> {
    const archiveDatabaseUrl = this.config.get<string>('ARCHIVE_DATABASE_URL');

    if (!archiveDatabaseUrl) {
      this.logger.warn(
        'ARCHIVE_DATABASE_URL is not set. Retention archive job will be skipped.',
      );
      return;
    }

    this.archivePool = new Pool({
      connectionString: archiveDatabaseUrl,
      ssl: this.config.get<boolean>('ARCHIVE_DB_SSL')
        ? { rejectUnauthorized: false }
        : undefined,
    });

    try {
      await this.ensureArchiveSchema();
    } catch (error) {
      this.logger.error(
        `Archive database is unavailable; retention archiving is disabled: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.archivePool.end().catch(() => undefined);
      this.archivePool = null;
      this.archiveReady = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.archivePool?.end();
  }

  @Cron('0 15 2 * * *')
  async archiveExpiredData(): Promise<void> {
    if (!this.config.get<boolean>('RETENTION_ENABLED')) {
      return;
    }

    if (!this.archivePool || !this.archiveReady) {
      this.logger.warn(
        'Skipping retention job because archive DB is not ready',
      );
      return;
    }

    const retentionDays = this.config.getOrThrow<number>('DATA_RETENTION_DAYS');

    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
      this.logger.warn(
        'Skipping retention job because DATA_RETENTION_DAYS < 1',
      );
      return;
    }

    const cutoff = startOfUtcDay(daysAgo(retentionDays));

    await this.archiveOldestExpiredDay(
      {
        repository: this.lockEventsRepository,
        tableName: 'lock_events',
        timestampColumn: 'occurredAt',
      },
      cutoff,
    );
    await this.archiveOldestExpiredDay(
      {
        repository: this.lockPositionsRepository,
        tableName: 'lock_positions',
        timestampColumn: 'recordedAt',
      },
      cutoff,
    );
    await this.archiveOldestExpiredDay(
      {
        repository: this.geofenceTransitionsRepository,
        tableName: 'geofence_transitions',
        timestampColumn: 'occurredAt',
      },
      cutoff,
    );
  }

  private async ensureArchiveSchema(): Promise<void> {
    if (!this.archivePool) {
      return;
    }

    await this.archivePool.query(`
      CREATE TABLE IF NOT EXISTS archived_records (
        id bigserial PRIMARY KEY,
        source_table varchar(80) NOT NULL,
        source_id uuid NOT NULL,
        terminal_id varchar(32),
        data_timestamp timestamptz NOT NULL,
        payload jsonb NOT NULL,
        archived_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (source_table, source_id)
      );

      CREATE INDEX IF NOT EXISTS archived_records_source_table_idx
        ON archived_records (source_table);

      CREATE INDEX IF NOT EXISTS archived_records_terminal_id_idx
        ON archived_records (terminal_id);

      CREATE INDEX IF NOT EXISTS archived_records_data_timestamp_idx
        ON archived_records (data_timestamp);
    `);
    this.archiveReady = true;
  }

  private async archiveOldestExpiredDay<T extends RetentionEntity>(
    job: RetentionJobConfig<T>,
    cutoff: Date,
  ): Promise<void> {
    const oldestExpired = await job.repository.findOne({
      where: {
        deletedAt: IsNull(),
        [job.timestampColumn]: LessThan(cutoff),
      } as object,
      order: { [job.timestampColumn]: 'ASC' } as object,
    });

    if (!oldestExpired) {
      return;
    }

    const dayStart = startOfUtcDay(getRetentionTimestamp(job, oldestExpired));
    const dayEnd = nextUtcDay(dayStart);
    const batchSize = this.config.getOrThrow<number>(
      'RETENTION_ARCHIVE_BATCH_SIZE',
    );
    const rows = await job.repository.find({
      where: {
        deletedAt: IsNull(),
        [job.timestampColumn]: Between(dayStart, dayEnd),
      } as object,
      order: { [job.timestampColumn]: 'ASC' } as object,
      take: batchSize,
    });

    if (rows.length === 0) {
      return;
    }

    await this.archiveRows(job, rows);
    await job.repository.softDelete(rows.map((row) => row.id));

    this.logger.log(
      `Archived and soft-deleted ${rows.length} ${job.tableName} rows for ${dayStart.toISOString().slice(0, 10)}`,
    );
  }

  private async archiveRows<T extends RetentionEntity>(
    job: RetentionJobConfig<T>,
    rows: T[],
  ): Promise<void> {
    if (!this.archivePool) {
      return;
    }

    const client = await this.archivePool.connect();

    try {
      await client.query('BEGIN');

      for (const row of rows) {
        await client.query(
          `
            INSERT INTO archived_records (
              source_table,
              source_id,
              terminal_id,
              data_timestamp,
              payload
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (source_table, source_id)
            DO UPDATE SET
              terminal_id = EXCLUDED.terminal_id,
              data_timestamp = EXCLUDED.data_timestamp,
              payload = EXCLUDED.payload,
              archived_at = now()
          `,
          [
            job.tableName,
            row.id,
            row.terminalId,
            getRetentionTimestamp(job, row),
            JSON.stringify(row),
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function nextUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + 1);
  return copy;
}

function getRetentionTimestamp<T extends RetentionEntity>(
  job: RetentionJobConfig<T>,
  row: T,
): Date {
  return job.timestampColumn === 'occurredAt'
    ? (row as LockEvent | GeofenceTransition).occurredAt
    : (row as LockPosition).recordedAt;
}

DO $$
BEGIN
  CREATE TYPE lock_events_status_enum AS ENUM (
    'unread',
    'read',
    'investigating',
    'resolve'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE lock_events
  ADD COLUMN IF NOT EXISTS status lock_events_status_enum NOT NULL DEFAULT 'unread';

CREATE INDEX IF NOT EXISTS lock_events_status_occurred_idx
  ON lock_events (status, "occurredAt" DESC)
  WHERE "deletedAt" IS NULL;

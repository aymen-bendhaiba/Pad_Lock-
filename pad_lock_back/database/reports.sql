ALTER TABLE lock_events
  ADD COLUMN IF NOT EXISTS geofences jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS geofence_device_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "terminalId" varchar(32) NOT NULL,
  "geofenceId" uuid NOT NULL,
  "isInside" boolean NOT NULL,
  "lastObservedAt" timestamptz NOT NULL,
  "lastChangedAt" timestamptz,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("terminalId", "geofenceId")
);

CREATE TABLE IF NOT EXISTS geofence_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "terminalId" varchar(32) NOT NULL,
  "geofenceId" uuid NOT NULL,
  "geofenceName" varchar(120) NOT NULL,
  type varchar(12) NOT NULL CHECK (type IN ('enter', 'exit')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  "occurredAt" timestamptz NOT NULL,
  "receivedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS lock_events_geofences_gin_idx
  ON lock_events USING GIN (geofences);

CREATE INDEX IF NOT EXISTS geofence_device_states_terminal_idx
  ON geofence_device_states ("terminalId");

CREATE INDEX IF NOT EXISTS geofence_transitions_terminal_time_idx
  ON geofence_transitions ("terminalId", "occurredAt" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS geofence_transitions_geofence_time_idx
  ON geofence_transitions ("geofenceId", "occurredAt" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS geofence_transitions_retention_idx
  ON geofence_transitions ("deletedAt", "occurredAt");

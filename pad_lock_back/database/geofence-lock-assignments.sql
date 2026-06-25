ALTER TABLE geofences
  ADD COLUMN IF NOT EXISTS "terminalIds" text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS geofences_terminal_ids_gin_idx
  ON geofences USING GIN ("terminalIds");

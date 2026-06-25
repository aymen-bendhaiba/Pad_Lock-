CREATE EXTENSION IF NOT EXISTS postgis;

CREATE INDEX IF NOT EXISTS lock_positions_terminal_recorded_idx
  ON lock_positions ("terminalId", "recordedAt" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS lock_positions_retention_idx
  ON lock_positions ("deletedAt", "recordedAt");

CREATE INDEX IF NOT EXISTS lock_events_terminal_occurred_idx
  ON lock_events ("terminalId", "occurredAt" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS lock_events_retention_idx
  ON lock_events ("deletedAt", "occurredAt");

CREATE INDEX IF NOT EXISTS rfid_cards_lock_active_created_idx
  ON rfid_cards ("lockDeviceId", active, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS rfid_cards_lock_role_active_idx
  ON rfid_cards ("lockDeviceId", role, active);

CREATE INDEX IF NOT EXISTS rfid_cards_lock_role_active_installed_idx
  ON rfid_cards ("lockDeviceId", role, active, "installedOnLock");

CREATE INDEX IF NOT EXISTS rfid_cards_lock_sync_status_idx
  ON rfid_cards ("lockDeviceId", "lastSyncStatus");

CREATE INDEX IF NOT EXISTS geofences_geo_boundary_idx
  ON geofences ("geoBoundaryId")
  WHERE "geoBoundaryId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS geofences_created_idx
  ON geofences ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS geo_boundaries_geometry_gist_idx
  ON geo_boundaries USING GIST (geometry);

CREATE INDEX IF NOT EXISTS geo_boundaries_type_name_idx
  ON geo_boundaries (type, name);

CREATE INDEX IF NOT EXISTS geo_boundaries_country_code_idx
  ON geo_boundaries ("countryCode");

ALTER TABLE rfid_cards
  ADD COLUMN IF NOT EXISTS "installedOnLock" boolean NOT NULL DEFAULT false;

ALTER TABLE rfid_cards
  ADD COLUMN IF NOT EXISTS "lastSyncStatus" varchar(40) NOT NULL DEFAULT 'pending_add';

ALTER TABLE rfid_cards
  ADD COLUMN IF NOT EXISTS "lastSyncError" text;

ALTER TABLE rfid_cards
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" timestamptz;

CREATE INDEX IF NOT EXISTS rfid_cards_lock_role_active_installed_idx
  ON rfid_cards ("lockDeviceId", role, active, "installedOnLock");

CREATE INDEX IF NOT EXISTS rfid_cards_lock_sync_status_idx
  ON rfid_cards ("lockDeviceId", "lastSyncStatus");

CREATE TABLE IF NOT EXISTS lock_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lockDeviceId" uuid NOT NULL UNIQUE
    REFERENCES lock_devices(id) ON DELETE CASCADE,
  "sim1IpAddress" varchar(255),
  "sim1Port" integer,
  "sim1Apn" varchar(50),
  "sim1ApnUser" varchar(50),
  "sim1ApnPasswordEncrypted" text,
  "sim2IpAddress" varchar(255),
  "sim2Port" integer,
  "sim2Apn" varchar(50),
  "sim2ApnUser" varchar(50),
  "sim2ApnPasswordEncrypted" text,
  "trackingUploadIntervalSeconds" integer NOT NULL DEFAULT 30,
  "wakeUpIntervalMinutes" integer NOT NULL DEFAULT 30,
  "vibrationLevelMg" integer NOT NULL DEFAULT 126,
  "sim1SyncStatus" varchar(16),
  "sim1SyncError" text,
  "sim1SyncedAt" timestamptz,
  "sim2SyncStatus" varchar(16),
  "sim2SyncError" text,
  "sim2SyncedAt" timestamptz,
  "reportingSyncStatus" varchar(16),
  "reportingSyncError" text,
  "reportingSyncedAt" timestamptz,
  "vibrationSyncStatus" varchar(16),
  "vibrationSyncError" text,
  "vibrationSyncedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lock_configurations_sim1_port_check
    CHECK ("sim1Port" IS NULL OR "sim1Port" BETWEEN 1 AND 65530),
  CONSTRAINT lock_configurations_sim2_port_check
    CHECK ("sim2Port" IS NULL OR "sim2Port" BETWEEN 1 AND 65530),
  CONSTRAINT lock_configurations_upload_interval_check
    CHECK ("trackingUploadIntervalSeconds" BETWEEN 5 AND 600),
  CONSTRAINT lock_configurations_wakeup_interval_check
    CHECK ("wakeUpIntervalMinutes" BETWEEN 5 AND 1440),
  CONSTRAINT lock_configurations_vibration_check
    CHECK ("vibrationLevelMg" = 0 OR "vibrationLevelMg" BETWEEN 63 AND 500),
  CONSTRAINT lock_configurations_sim1_status_check
    CHECK ("sim1SyncStatus" IS NULL OR "sim1SyncStatus" IN ('synced', 'pending', 'failed')),
  CONSTRAINT lock_configurations_sim2_status_check
    CHECK ("sim2SyncStatus" IS NULL OR "sim2SyncStatus" IN ('synced', 'pending', 'failed')),
  CONSTRAINT lock_configurations_reporting_status_check
    CHECK ("reportingSyncStatus" IS NULL OR "reportingSyncStatus" IN ('synced', 'pending', 'failed')),
  CONSTRAINT lock_configurations_vibration_status_check
    CHECK ("vibrationSyncStatus" IS NULL OR "vibrationSyncStatus" IN ('synced', 'pending', 'failed'))
);

CREATE INDEX IF NOT EXISTS lock_configurations_pending_sync_idx
  ON lock_configurations (
    "sim1SyncStatus",
    "sim2SyncStatus",
    "reportingSyncStatus",
    "vibrationSyncStatus"
  );

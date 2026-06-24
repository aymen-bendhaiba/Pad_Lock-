ALTER TABLE lock_positions
  ADD COLUMN IF NOT EXISTS "isPositioned" boolean NOT NULL DEFAULT false;

ALTER TABLE lock_positions
  ADD COLUMN IF NOT EXISTS mileage integer;

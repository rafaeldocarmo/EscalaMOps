-- Add normalized phone column for fast lookup
ALTER TABLE "team_members"
ADD COLUMN "normalized_phone" TEXT;

-- Backfill from existing phone values:
-- keep only digits, so "(11) 99999-9999" -> "11999999999"
UPDATE "team_members"
SET "normalized_phone" = regexp_replace("phone", '\D', '', 'g')
WHERE "normalized_phone" IS NULL;

-- Ensure future rows must have it
ALTER TABLE "team_members"
ALTER COLUMN "normalized_phone" SET NOT NULL;

-- Index for lookups
CREATE INDEX "team_members_normalized_phone_idx"
ON "team_members" ("normalized_phone");


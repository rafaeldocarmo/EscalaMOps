-- Backfill schedules missing team_id (required before NOT NULL)
UPDATE "schedules" AS s
SET "team_id" = t.id
FROM "teams" AS t
WHERE s."team_id" IS NULL
  AND t."name" = 'Equipe Principal';

-- Enforce team on every schedule row
ALTER TABLE "schedules" ALTER COLUMN "team_id" SET NOT NULL;

-- Replace legacy uniqueness (one schedule per calendar month globally)
DROP INDEX IF EXISTS "schedules_year_month_key";

-- One schedule per team per month
CREATE UNIQUE INDEX "schedules_team_id_year_month_key" ON "schedules"("team_id", "year", "month");

-- Add color fields to team_levels and team_shifts
-- Colors are stored as hex strings (e.g. #3b82f6)

ALTER TABLE "team_levels"
ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#64748b';

ALTER TABLE "team_shifts"
ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#64748b';


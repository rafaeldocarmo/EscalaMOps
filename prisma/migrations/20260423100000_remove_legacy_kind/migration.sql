-- Migration: remove legacyKind and deprecated level/shift columns
-- Purpose: fully remove the legacy enum mapping system; catalog IDs are the only truth

-- Drop deprecated columns from team_members
ALTER TABLE "team_members" DROP COLUMN IF EXISTS "level";
ALTER TABLE "team_members" DROP COLUMN IF EXISTS "shift";

-- Drop legacy_kind from team_levels (including the unique constraint)
ALTER TABLE "team_levels" DROP CONSTRAINT IF EXISTS "team_levels_team_id_legacy_kind_key";
ALTER TABLE "team_levels" DROP COLUMN IF EXISTS "legacy_kind";

-- Drop legacy_kind from team_shifts (including the unique constraint)
ALTER TABLE "team_shifts" DROP CONSTRAINT IF EXISTS "team_shifts_team_id_legacy_kind_key";
ALTER TABLE "team_shifts" DROP COLUMN IF EXISTS "legacy_kind";

-- Drop deprecated level column from on_call_assignments
ALTER TABLE "on_call_assignments" DROP COLUMN IF EXISTS "level";

-- Drop Level and Shift enum types (no longer referenced by any column)
DROP TYPE IF EXISTS "Level";
DROP TYPE IF EXISTS "Shift";

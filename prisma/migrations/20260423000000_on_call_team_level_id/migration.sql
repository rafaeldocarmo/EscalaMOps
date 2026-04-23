-- Migration: add team_level_id to on_call_assignments and make level nullable
-- Purpose: support custom catalog levels (legacyKind=null) in sobreaviso rotation

ALTER TABLE "on_call_assignments" ADD COLUMN "team_level_id" TEXT;

ALTER TABLE "on_call_assignments" ALTER COLUMN "level" DROP NOT NULL;

ALTER TABLE "on_call_assignments"
  ADD CONSTRAINT "on_call_assignments_team_level_id_fkey"
  FOREIGN KEY ("team_level_id")
  REFERENCES "team_levels"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "on_call_assignments_team_level_id_idx" ON "on_call_assignments"("team_level_id");

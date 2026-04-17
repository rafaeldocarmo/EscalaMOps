-- Idempotent: recovers indexes if a prior local migration incorrectly dropped them.
CREATE INDEX IF NOT EXISTS "schedules_team_id_idx" ON "schedules"("team_id");

CREATE UNIQUE INDEX IF NOT EXISTS "teams_one_default_idx" ON "teams" ("is_default") WHERE "is_default" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "users_one_global_admin_idx" ON "users" ("is_global_admin") WHERE ("is_global_admin" = true);

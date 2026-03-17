-- Add `on_call_rotation_index` to TeamMember.
-- This migration is intentionally minimal to avoid destructive changes.
ALTER TABLE "team_members"
ADD COLUMN IF NOT EXISTS "on_call_rotation_index" INTEGER NOT NULL DEFAULT 0;

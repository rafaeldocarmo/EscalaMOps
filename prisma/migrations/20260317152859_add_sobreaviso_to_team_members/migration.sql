-- Add `sobreaviso` flag to TeamMember.
-- This migration is intentionally minimal to avoid destructive changes.
ALTER TABLE "team_members"
ADD COLUMN IF NOT EXISTS "sobreaviso" BOOLEAN NOT NULL DEFAULT false;

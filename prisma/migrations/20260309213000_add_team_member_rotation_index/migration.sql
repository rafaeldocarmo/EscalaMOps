-- AlterTable
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "rotation_index" INTEGER NOT NULL DEFAULT 0;

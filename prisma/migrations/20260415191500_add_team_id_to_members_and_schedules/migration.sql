-- AlterTable (expansive, nullable to keep backward compatibility)
ALTER TABLE "team_members" ADD COLUMN "team_id" TEXT;
ALTER TABLE "schedules" ADD COLUMN "team_id" TEXT;

-- CreateIndex (helps future filtering by team)
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");
CREATE INDEX "schedules_team_id_idx" ON "schedules"("team_id");

-- AddForeignKey (restrict deletes to avoid accidental cascade in production)
ALTER TABLE "team_members"
ADD CONSTRAINT "team_members_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "teams"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "teams"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;


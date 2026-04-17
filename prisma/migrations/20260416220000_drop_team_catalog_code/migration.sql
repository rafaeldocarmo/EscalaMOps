-- DropUnique
DROP INDEX IF EXISTS "team_levels_team_id_code_key";

-- DropUnique
DROP INDEX IF EXISTS "team_shifts_team_id_code_key";

-- AlterTable
ALTER TABLE "team_levels" DROP COLUMN "code";

-- AlterTable
ALTER TABLE "team_shifts" DROP COLUMN "code";

-- CreateIndex
CREATE UNIQUE INDEX "team_levels_team_id_label_key" ON "team_levels"("team_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "team_shifts_team_id_label_key" ON "team_shifts"("team_id", "label");

-- Regras de escala parametrizáveis (substitui as constantes WEEKEND_COVERAGE e
-- COMPENSATION_GABARITO que viviam em server/schedule/queueManager.ts e
-- server/schedule/offDayAllocator.ts).

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('WEEKEND_COVERAGE', 'COMPENSATION_PATTERN');

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "team_shift_id" TEXT,
    "team_level_id" TEXT,
    "kind" "RuleKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "params" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_rules_team_id_kind_enabled_idx" ON "schedule_rules"("team_id", "kind", "enabled");

-- CreateIndex
CREATE INDEX "schedule_rules_team_shift_id_idx" ON "schedule_rules"("team_shift_id");

-- CreateIndex
CREATE INDEX "schedule_rules_team_level_id_idx" ON "schedule_rules"("team_level_id");

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_team_shift_id_fkey" FOREIGN KEY ("team_shift_id") REFERENCES "team_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_team_level_id_fkey" FOREIGN KEY ("team_level_id") REFERENCES "team_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

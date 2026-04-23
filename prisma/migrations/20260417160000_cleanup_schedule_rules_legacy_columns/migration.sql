-- Limpeza da tabela schedule_rules para bater com o escopo reduzido das
-- regras parametrizáveis (só WEEKEND_COVERAGE e COMPENSATION_PATTERN):
--
-- 1. Drop FK/índice de member_id (sem regra por membro neste escopo).
-- 2. Drop colunas severity, valid_from, valid_to, notes, created_by
--    (vieram de um design anterior mais amplo).
-- 3. Drop índice kind_enabled (redundante com team_id_kind_enabled).
-- 4. Torna team_id NOT NULL (toda regra pertence a uma equipe).
-- 5. Drop enum RuleSeverity.
-- 6. Limpa dados legados que possam existir com shape inválido antes do
--    backfill re-popular com os defaults.

DELETE FROM "schedule_rules";

ALTER TABLE "schedule_rules" DROP CONSTRAINT IF EXISTS "schedule_rules_member_id_fkey";
DROP INDEX IF EXISTS "schedule_rules_member_id_idx";
DROP INDEX IF EXISTS "schedule_rules_kind_enabled_idx";

ALTER TABLE "schedule_rules"
  DROP COLUMN IF EXISTS "member_id",
  DROP COLUMN IF EXISTS "severity",
  DROP COLUMN IF EXISTS "valid_from",
  DROP COLUMN IF EXISTS "valid_to",
  DROP COLUMN IF EXISTS "notes",
  DROP COLUMN IF EXISTS "created_by";

ALTER TABLE "schedule_rules" ALTER COLUMN "team_id" SET NOT NULL;

DROP TYPE IF EXISTS "RuleSeverity";

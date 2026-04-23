-- Reduz o enum RuleKind para apenas os dois tipos em uso no motor atual.
-- Valores antigos (MAX_SHIFTS_PER_WEEK, MIN_REST_BETWEEN_SHIFTS, etc.) vieram
-- de um design mais amplo que foi descartado para o escopo atual.
--
-- Estratégia: renomeia o enum antigo, cria o novo com o conjunto mínimo,
-- converte a coluna e dropa o antigo.

ALTER TYPE "RuleKind" RENAME TO "RuleKind_old";

CREATE TYPE "RuleKind" AS ENUM ('WEEKEND_COVERAGE', 'COMPENSATION_PATTERN');

ALTER TABLE "schedule_rules"
  ALTER COLUMN "kind" TYPE "RuleKind"
  USING ("kind"::text::"RuleKind");

DROP TYPE "RuleKind_old";

-- =========================================================
--  Fase 1: catálogo como fonte de verdade para TeamMember
--
--  Objetivo desta migration:
--    1. TeamLevel e TeamShift ganham coluna legacy_kind (mapeia para o enum atual).
--    2. TeamMember ganha team_level_id e team_shift_id (FKs, NOT NULL).
--    3. Backfill populando o catálogo por equipe e amarrando cada membro.
--    4. Mantém TeamMember.level/shift (enum) e OnCallAssignment.level por compat —
--       serão removidos em uma fase posterior, junto da parametrização de regras.
--
--  Regras hardcoded de escala/sobreaviso NÃO mudam aqui: elas passam a ler
--  `level`/`shift` derivados de `teamLevel.legacyKind` / `teamShift.legacyKind`
--  no código (nos passos seguintes do refator), sem alterar lógica.
-- =========================================================

-- pgcrypto fornece gen_random_uuid() em PG <13. No Neon (PG 15+) já é nativo,
-- mas garantir é barato e idempotente.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------
-- 1) Novas colunas nos catálogos (nullable)
-- ---------------------------------------------------------
ALTER TABLE "team_levels" ADD COLUMN IF NOT EXISTS "legacy_kind" "Level";
ALTER TABLE "team_shifts" ADD COLUMN IF NOT EXISTS "legacy_kind" "Shift";

-- ---------------------------------------------------------
-- 2) Novas colunas em team_members (nullable por enquanto; viram NOT NULL após backfill)
-- ---------------------------------------------------------
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "team_level_id" TEXT;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "team_shift_id" TEXT;

-- ---------------------------------------------------------
-- 3) Backfill
-- ---------------------------------------------------------

-- 3.a) Membros órfãos (team_id IS NULL) são atribuídos à equipe is_default = TRUE.
--      Se ninguém for default, usa a primeira equipe cadastrada. Se não houver
--      equipe alguma, cria "Equipe Principal" automaticamente para destravar.
DO $$
DECLARE
  v_team_id TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "team_members" WHERE "team_id" IS NULL) THEN
    SELECT id INTO v_team_id FROM "teams" WHERE "is_default" = TRUE LIMIT 1;

    IF v_team_id IS NULL THEN
      SELECT id INTO v_team_id FROM "teams" ORDER BY "createdAt" ASC LIMIT 1;
    END IF;

    IF v_team_id IS NULL THEN
      v_team_id := 'c' || lower(replace(gen_random_uuid()::text, '-', ''));
      INSERT INTO "teams" ("id", "name", "is_default", "createdAt", "updatedAt")
      VALUES (v_team_id, 'Equipe Principal', TRUE, NOW(), NOW());
    END IF;

    UPDATE "team_members" SET "team_id" = v_team_id WHERE "team_id" IS NULL;
  END IF;
END $$;

-- 3.b) Preencher legacy_kind em linhas já existentes do catálogo cujo label bata
--      com algum valor do enum (tolerante a caixa e acento).
UPDATE "team_levels" SET "legacy_kind" = 'N1'::"Level"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) = 'N1';
UPDATE "team_levels" SET "legacy_kind" = 'N2'::"Level"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) = 'N2';
UPDATE "team_levels" SET "legacy_kind" = 'ESPC'::"Level"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) IN ('ESPC', 'ESPECIALISTA');
UPDATE "team_levels" SET "legacy_kind" = 'PRODUCAO'::"Level"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) IN ('PRODUCAO', 'PRODUÇÃO');

UPDATE "team_shifts" SET "legacy_kind" = 'T1'::"Shift"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) = 'T1';
UPDATE "team_shifts" SET "legacy_kind" = 'T2'::"Shift"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) = 'T2';
UPDATE "team_shifts" SET "legacy_kind" = 'T3'::"Shift"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) = 'T3';
UPDATE "team_shifts" SET "legacy_kind" = 'TC'::"Shift"
  WHERE "legacy_kind" IS NULL AND UPPER(TRIM("label")) = 'TC';

-- 3.c) Para cada equipe que tem membros, garantir um TeamLevel/TeamShift
--      por legacy_kind. Se o label base (ex. "N1") já estiver em uso por outra
--      linha sem legacy_kind (já coberto em 3.b), não há colisão; caso raro de
--      label duplicado com caixa diferente ("n1"), acrescenta sufixo único.
INSERT INTO "team_levels" ("id", "team_id", "label", "legacy_kind", "sort_order", "createdAt", "updatedAt")
SELECT
  'c' || lower(replace(gen_random_uuid()::text, '-', '')),
  t.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "team_levels" x
      WHERE x.team_id = t.id AND x.label = lk.label
    ) THEN lk.label || ' (' || lk.kind || ')'
    ELSE lk.label
  END,
  lk.kind::"Level",
  lk.sort_order,
  NOW(),
  NOW()
FROM "teams" t
CROSS JOIN (VALUES
  ('N1',       'N1',       0),
  ('N2',       'N2',       1),
  ('ESPC',     'ESPC',     2),
  ('PRODUCAO', 'Produção', 3)
) AS lk(kind, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "team_levels" tl
  WHERE tl.team_id = t.id AND tl.legacy_kind = lk.kind::"Level"
);

INSERT INTO "team_shifts" ("id", "team_id", "label", "legacy_kind", "sort_order", "createdAt", "updatedAt")
SELECT
  'c' || lower(replace(gen_random_uuid()::text, '-', '')),
  t.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "team_shifts" x
      WHERE x.team_id = t.id AND x.label = sk.label
    ) THEN sk.label || ' (' || sk.kind || ')'
    ELSE sk.label
  END,
  sk.kind::"Shift",
  sk.sort_order,
  NOW(),
  NOW()
FROM "teams" t
CROSS JOIN (VALUES
  ('T1', 'T1', 0),
  ('T2', 'T2', 1),
  ('T3', 'T3', 2),
  ('TC', 'TC', 3)
) AS sk(kind, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "team_shifts" ts
  WHERE ts.team_id = t.id AND ts.legacy_kind = sk.kind::"Shift"
);

-- 3.d) Amarrar cada TeamMember ao TeamLevel/TeamShift correspondente via legacy_kind.
UPDATE "team_members" tm
SET "team_level_id" = tl.id
FROM "team_levels" tl
WHERE tl.team_id = tm.team_id
  AND tl.legacy_kind = tm.level
  AND tm.team_level_id IS NULL;

UPDATE "team_members" tm
SET "team_shift_id" = ts.id
FROM "team_shifts" ts
WHERE ts.team_id = tm.team_id
  AND ts.legacy_kind = tm.shift
  AND tm.team_shift_id IS NULL;

-- 3.e) Guardrail: falha alto-e-claro se o backfill deixou alguém sem FK.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "team_members" WHERE "team_level_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto: existem team_members sem team_level_id.';
  END IF;
  IF EXISTS (SELECT 1 FROM "team_members" WHERE "team_shift_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto: existem team_members sem team_shift_id.';
  END IF;
END $$;

-- 3.f) Garantir matriz mínima de combinações permitidas: toda combinação
--      (level, shift) que já é praticada por algum membro entra em
--      team_level_allowed_shifts. Evita que validações passem a rejeitar
--      membros válidos que existiam antes da migration.
INSERT INTO "team_level_allowed_shifts" ("team_level_id", "team_shift_id")
SELECT DISTINCT tm.team_level_id, tm.team_shift_id
FROM "team_members" tm
WHERE NOT EXISTS (
  SELECT 1 FROM "team_level_allowed_shifts" tlas
  WHERE tlas.team_level_id = tm.team_level_id
    AND tlas.team_shift_id = tm.team_shift_id
);

-- ---------------------------------------------------------
-- 4) NOT NULL + índices + uniques + FKs
-- ---------------------------------------------------------
ALTER TABLE "team_members" ALTER COLUMN "team_level_id" SET NOT NULL;
ALTER TABLE "team_members" ALTER COLUMN "team_shift_id" SET NOT NULL;

-- unique (team_id, legacy_kind): Postgres trata múltiplos NULL como distintos,
-- então níveis/turnos custom (legacy_kind NULL) continuam convivendo.
CREATE UNIQUE INDEX IF NOT EXISTS "team_levels_team_id_legacy_kind_key"
  ON "team_levels" ("team_id", "legacy_kind");
CREATE UNIQUE INDEX IF NOT EXISTS "team_shifts_team_id_legacy_kind_key"
  ON "team_shifts" ("team_id", "legacy_kind");

CREATE INDEX IF NOT EXISTS "team_members_team_level_id_idx"
  ON "team_members" ("team_level_id");
CREATE INDEX IF NOT EXISTS "team_members_team_shift_id_idx"
  ON "team_members" ("team_shift_id");

ALTER TABLE "team_members"
  ADD CONSTRAINT "team_members_team_level_id_fkey"
  FOREIGN KEY ("team_level_id") REFERENCES "team_levels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_members"
  ADD CONSTRAINT "team_members_team_shift_id_fkey"
  FOREIGN KEY ("team_shift_id") REFERENCES "team_shifts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

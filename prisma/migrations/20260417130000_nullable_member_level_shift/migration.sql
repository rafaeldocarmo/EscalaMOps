-- Torna TeamMember.level e TeamMember.shift nullable para permitir membros
-- associados a entradas do catálogo personalizadas (legacyKind = NULL), que
-- ficam fora das regras legadas de escala/sobreaviso/on-call.
--
-- Fonte de verdade passa a ser `teamLevelId`/`teamShiftId` (FKs introduzidas
-- na migration 20260417120000_member_catalog_fk_no_enum). Os enums só refletem
-- `teamLevel.legacyKind` / `teamShift.legacyKind`.

ALTER TABLE "team_members" ALTER COLUMN "level" DROP NOT NULL;
ALTER TABLE "team_members" ALTER COLUMN "shift" DROP NOT NULL;

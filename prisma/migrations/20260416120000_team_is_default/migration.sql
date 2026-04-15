-- AlterTable
ALTER TABLE "teams" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Garante exatamente uma equipe padrão (preferir nome legado, senão a mais antiga).
UPDATE "teams" SET "is_default" = false;
UPDATE "teams" SET "is_default" = true
WHERE "id" = (
  SELECT "id" FROM "teams"
  ORDER BY
    CASE WHEN "name" = 'Equipe Principal' THEN 0 ELSE 1 END,
    "createdAt" ASC
  LIMIT 1
);

-- Apenas uma linha pode ser padrão (PostgreSQL partial unique index).
CREATE UNIQUE INDEX "teams_one_default_idx" ON "teams" ("is_default") WHERE "is_default" = true;

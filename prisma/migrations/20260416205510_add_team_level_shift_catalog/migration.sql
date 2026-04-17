-- CreateTable
CREATE TABLE "team_levels" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_shifts" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_level_allowed_shifts" (
    "team_level_id" TEXT NOT NULL,
    "team_shift_id" TEXT NOT NULL,

    CONSTRAINT "team_level_allowed_shifts_pkey" PRIMARY KEY ("team_level_id","team_shift_id")
);

-- CreateIndex
CREATE INDEX "team_levels_team_id_idx" ON "team_levels"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_levels_team_id_code_key" ON "team_levels"("team_id", "code");

-- CreateIndex
CREATE INDEX "team_shifts_team_id_idx" ON "team_shifts"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_shifts_team_id_code_key" ON "team_shifts"("team_id", "code");

-- CreateIndex
CREATE INDEX "team_level_allowed_shifts_team_shift_id_idx" ON "team_level_allowed_shifts"("team_shift_id");

-- AddForeignKey
ALTER TABLE "team_levels" ADD CONSTRAINT "team_levels_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_shifts" ADD CONSTRAINT "team_shifts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_level_allowed_shifts" ADD CONSTRAINT "team_level_allowed_shifts_team_level_id_fkey" FOREIGN KEY ("team_level_id") REFERENCES "team_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_level_allowed_shifts" ADD CONSTRAINT "team_level_allowed_shifts_team_shift_id_fkey" FOREIGN KEY ("team_shift_id") REFERENCES "team_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

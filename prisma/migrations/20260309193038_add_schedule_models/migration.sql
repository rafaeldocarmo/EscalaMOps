-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('WORK', 'OFF', 'SWAP_REQUESTED');

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedules_year_month_key" ON "schedules"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_assignments_schedule_id_member_id_date_key" ON "schedule_assignments"("schedule_id", "member_id", "date");

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

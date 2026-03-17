/*
  Warnings:

  - You are about to drop the `rotation_queue_entries` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "SwapType" ADD VALUE 'ONCALL_SWAP';

-- DropForeignKey
ALTER TABLE "rotation_queue_entries" DROP CONSTRAINT "rotation_queue_entries_member_id_fkey";

-- DropTable
DROP TABLE "rotation_queue_entries";

-- CreateTable
CREATE TABLE "on_call_assignments" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "on_call_assignments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "on_call_assignments" ADD CONSTRAINT "on_call_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

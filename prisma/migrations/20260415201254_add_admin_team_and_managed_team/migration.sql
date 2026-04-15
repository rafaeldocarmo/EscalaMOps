-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN_TEAM';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "managed_team_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managed_team_id_fkey" FOREIGN KEY ("managed_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_global_admin" BOOLEAN NOT NULL DEFAULT false;

-- At most one global admin (PostgreSQL partial unique index)
CREATE UNIQUE INDEX "users_one_global_admin_idx" ON "users" ("is_global_admin") WHERE ("is_global_admin" = true);

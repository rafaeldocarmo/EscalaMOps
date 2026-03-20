-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankHourRequestType') THEN
    CREATE TYPE "BankHourRequestType" AS ENUM ('EXTRA_HOURS', 'OFF_HOURS');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankHourRequestStatus') THEN
    CREATE TYPE "BankHourRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_hour_balances" (
  "member_id" TEXT NOT NULL,
  "balance_hours" numeric(10,2) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_hour_balances_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_hour_requests" (
  "id" TEXT NOT NULL,
  "type" "BankHourRequestType" NOT NULL,
  "requester_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "hours" numeric(10,2) NOT NULL,
  "justification" TEXT,
  "status" "BankHourRequestStatus" NOT NULL,
  "admin_approved_at" TIMESTAMP(3),
  "admin_rejected_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_hour_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_hour_transactions" (
  "id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "delta_hours" numeric(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_hour_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_hour_transactions_request_id_key" UNIQUE ("request_id")
);

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'bank_hour_balances_member_id_fkey'
  ) THEN
    ALTER TABLE "bank_hour_balances"
      ADD CONSTRAINT "bank_hour_balances_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'bank_hour_requests_requester_id_fkey'
  ) THEN
    ALTER TABLE "bank_hour_requests"
      ADD CONSTRAINT "bank_hour_requests_requester_id_fkey"
      FOREIGN KEY ("requester_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'bank_hour_transactions_member_id_fkey'
  ) THEN
    ALTER TABLE "bank_hour_transactions"
      ADD CONSTRAINT "bank_hour_transactions_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'bank_hour_transactions_request_id_fkey'
  ) THEN
    ALTER TABLE "bank_hour_transactions"
      ADD CONSTRAINT "bank_hour_transactions_request_id_fkey"
      FOREIGN KEY ("request_id") REFERENCES "bank_hour_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "bank_hour_requests_requester_id_status_idx" ON "bank_hour_requests" ("requester_id", "status");


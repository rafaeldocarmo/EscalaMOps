-- CreateTable (enums SwapType and SwapRequestStatus may already exist)
CREATE TABLE IF NOT EXISTS "schedule_swap_requests" (
    "id" TEXT NOT NULL,
    "type" "SwapType" NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_member_id" TEXT,
    "original_date" TIMESTAMP(3),
    "target_date" TIMESTAMP(3),
    "status" "SwapRequestStatus" NOT NULL,
    "second_user_accepted_at" TIMESTAMP(3),
    "admin_approved_at" TIMESTAMP(3),
    "admin_rejected_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_swap_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (ignore if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_swap_requests_requester_id_fkey') THEN
    ALTER TABLE "schedule_swap_requests" ADD CONSTRAINT "schedule_swap_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_swap_requests_target_member_id_fkey') THEN
    ALTER TABLE "schedule_swap_requests" ADD CONSTRAINT "schedule_swap_requests_target_member_id_fkey" FOREIGN KEY ("target_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

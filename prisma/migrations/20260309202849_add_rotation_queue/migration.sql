-- CreateTable
CREATE TABLE "rotation_queue_entries" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "level" "Level" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "rotation_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rotation_queue_entries_member_id_key" ON "rotation_queue_entries"("member_id");

-- AddForeignKey
ALTER TABLE "rotation_queue_entries" ADD CONSTRAINT "rotation_queue_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

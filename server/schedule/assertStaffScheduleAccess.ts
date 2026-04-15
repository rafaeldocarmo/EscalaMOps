"use server";

import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function assertStaffCanMutateSchedule(
  session: Session | null,
  scheduleId: string
): Promise<void> {
  if (!session?.user) throw new Error("Acesso negado.");
  if (session.user.role === "ADMIN") return;
  if (session.user.role !== "ADMIN_TEAM" || !session.user.managedTeamId) {
    throw new Error("Acesso negado.");
  }
  const s = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { teamId: true },
  });
  if (s?.teamId !== session.user.managedTeamId) {
    throw new Error("Acesso negado.");
  }
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LockScheduleResult =
  | { success: true }
  | { success: false; error: string };

export async function lockSchedule(scheduleId: string): Promise<LockScheduleResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: "LOCKED" },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: "Erro ao bloquear escala." };
  }
}

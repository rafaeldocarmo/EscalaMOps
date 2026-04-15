"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";

export type LockScheduleResult =
  | { success: true }
  | { success: false; error: string };

export async function lockSchedule(scheduleId: string): Promise<LockScheduleResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await assertStaffCanMutateSchedule(session, scheduleId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
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

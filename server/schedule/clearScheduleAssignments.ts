"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";

export type ClearScheduleAssignmentsResult =
  | { success: true }
  | { success: false; error: string };

export async function clearScheduleAssignments(
  scheduleId: string
): Promise<ClearScheduleAssignmentsResult> {
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
    await prisma.scheduleAssignment.deleteMany({
      where: { scheduleId },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao limpar escala. Tente novamente." };
  }
}


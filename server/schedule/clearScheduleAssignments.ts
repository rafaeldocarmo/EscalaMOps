"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ClearScheduleAssignmentsResult =
  | { success: true }
  | { success: false; error: string };

export async function clearScheduleAssignments(
  scheduleId: string
): Promise<ClearScheduleAssignmentsResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
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


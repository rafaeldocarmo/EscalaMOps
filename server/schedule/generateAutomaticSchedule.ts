"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMonthlySchedule } from "./generateMonthlySchedule";
import { saveScheduleAssignments } from "./saveScheduleAssignments";
import type { ScheduleAssignmentRow } from "@/types/schedule";

export type GenerateAutomaticScheduleResult =
  | { success: true; assignments: ScheduleAssignmentRow[] }
  | { success: false; error: string };

/**
 * Generates the monthly schedule using the rotation algorithm, then persists
 * assignments to the given schedule. Returns the new assignments so the client
 * can re-render without full page refresh.
 */
export async function generateAutomaticSchedule(
  scheduleId: string
): Promise<GenerateAutomaticScheduleResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) {
    return { success: false, error: "Escala não encontrada." };
  }

  try {
    const assignments = await generateMonthlySchedule(schedule.month, schedule.year);
    const payload = assignments.map((a) => ({
      memberId: a.memberId,
      date: a.date,
      status: a.status,
    }));
    const saveResult = await saveScheduleAssignments(scheduleId, payload);
    if (!saveResult.success) {
      return saveResult;
    }
    const assignmentsForClient: ScheduleAssignmentRow[] = assignments.map((a) => ({
      id: "",
      scheduleId,
      memberId: a.memberId,
      date: a.date,
      status: a.status,
    }));
    return { success: true, assignments: assignmentsForClient };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar escala.";
    return { success: false, error: message };
  }
}

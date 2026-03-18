"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMonthlySchedule } from "./generateMonthlySchedule";
import { saveScheduleAssignments } from "./saveScheduleAssignments";
import { generateSobreavisoSchedule } from "@/server/sobreaviso/generateSobreavisoSchedule";
import { getSobreavisoScheduleForMonth, type SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import type { ScheduleAssignmentRow } from "@/types/schedule";

export type GenerateAutomaticScheduleResult =
  | { success: true; assignments: ScheduleAssignmentRow[]; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

// NOTE: Sobreaviso now has its own generator action.
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

  const existingCount = await prisma.scheduleAssignment.count({
    where: { scheduleId },
  });
  if (existingCount > 0) {
    return {
      success: false,
      error: "Esta escala já foi gerada/salva. Use “Limpar tabela” antes de gerar novamente.",
    };
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

    // Keep returning current sobreaviso snapshot (generation is separate now).
    const sobreavisoWeeks = await getSobreavisoScheduleForMonth(schedule.month, schedule.year);

    const assignmentsForClient: ScheduleAssignmentRow[] = assignments.map((a) => ({
      id: "",
      scheduleId,
      memberId: a.memberId,
      date: a.date,
      status: a.status,
    }));
    return { success: true, assignments: assignmentsForClient, sobreavisoWeeks };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar escala.";
    return { success: false, error: message };
  }
}

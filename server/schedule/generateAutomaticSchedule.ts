"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";
import { log } from "@/lib/log";
import { generateMonthlySchedule } from "./generateMonthlySchedule";
import { saveScheduleAssignments } from "./saveScheduleAssignments";
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
  if (!session?.user) {
    return { success: false, error: "Acesso negado." };
  }
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await assertStaffCanMutateSchedule(session, scheduleId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
  }

  log({
    level: "info",
    event: "schedule.generate_auto.start",
    data: { scheduleId, actorRole: session.user.role },
  });

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) {
    log({
      level: "warn",
      event: "schedule.generate_auto.schedule_not_found",
      data: { scheduleId },
    });
    return { success: false, error: "Escala não encontrada." };
  }

  const existingCount = await prisma.scheduleAssignment.count({
    where: { scheduleId },
  });
  if (existingCount > 0) {
    log({
      level: "warn",
      event: "schedule.generate_auto.blocked_existing_assignments",
      data: { scheduleId, existingCount },
    });
    return {
      success: false,
      error: "Esta escala já foi gerada/salva. Use “Limpar tabela” antes de gerar novamente.",
    };
  }

  try {
    log({
      level: "info",
      event: "schedule.generate_auto.compute_assignments",
      data: { scheduleId, year: schedule.year, month: schedule.month },
    });
    const assignments = await generateMonthlySchedule(schedule.month, schedule.year);
    const payload = assignments.map((a) => ({
      memberId: a.memberId,
      date: a.date,
      status: a.status,
    }));
    const saveResult = await saveScheduleAssignments(scheduleId, payload);
    if (!saveResult.success) {
      log({
        level: "error",
        event: "schedule.generate_auto.save_failed",
        data: { scheduleId, error: saveResult.error },
      });
      return saveResult;
    }

    // Keep returning current sobreaviso snapshot (generation is separate now).
    const sobreavisoWeeks = await getSobreavisoScheduleForMonth(
      schedule.month,
      schedule.year,
      schedule.teamId
    );

    const assignmentsForClient: ScheduleAssignmentRow[] = assignments.map((a) => ({
      id: "",
      scheduleId,
      memberId: a.memberId,
      date: a.date,
      status: a.status,
    }));
    log({
      level: "info",
      event: "schedule.generate_auto.success",
      data: { scheduleId, assignmentsCount: assignmentsForClient.length },
    });
    return { success: true, assignments: assignmentsForClient, sobreavisoWeeks };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar escala.";
    log({
      level: "error",
      event: "schedule.generate_auto.exception",
      message,
      data: { scheduleId },
    });
    return { success: false, error: message };
  }
}

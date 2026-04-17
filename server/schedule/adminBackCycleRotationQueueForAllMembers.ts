"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";
import type { ScheduleAssignmentRow } from "@/types/schedule";
import type { SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import { generateMonthlySchedule } from "./generateMonthlySchedule";
import { saveScheduleAssignments } from "./saveScheduleAssignments";
import { getSobreavisoScheduleForMonth } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import type { QueueMember } from "./queueManager";
import {
  WEEKEND_GROUPS,
  getQueueOrder,
} from "./queueManager";

export type AdminBackCycleRotationQueueForAllMembersResult =
  | { success: true; assignments: ScheduleAssignmentRow[]; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

/**
 * Cyclically shifts rotationIndex backwards by 1 position (per shift/level queue group):
 * - 1st -> last
 * - 2nd -> 1st
 * - 3rd -> 2nd
 * ...
 * Then regenerates the monthly schedule for the current schedule month/year.
 *
 * IMPORTANT: generateAutomaticSchedule() blocks when the table already has assignments, so we
 * explicitly clear schedule assignments and regenerate directly here.
 */
export async function adminBackCycleRotationQueueForAllMembers(
  scheduleId: string
): Promise<AdminBackCycleRotationQueueForAllMembersResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await assertStaffCanMutateSchedule(session, scheduleId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, month: true, year: true, teamId: true },
  });
  if (!schedule) {
    return { success: false, error: "Escala não encontrada." };
  }

  const rawRotationMembers = await prisma.teamMember.findMany({
    where: {
      participatesInSchedule: true,
      level: { in: ["N1", "N2"] },
      shift: { not: null },
    },
    orderBy: [{ rotationIndex: "asc" }, { name: "asc" }],
    select: { id: true, name: true, level: true, shift: true, rotationIndex: true },
  });
  const rotationMembers: QueueMember[] = rawRotationMembers.map((m) => ({
    id: m.id,
    name: m.name,
    level: m.level!,
    shift: m.shift!,
    rotationIndex: m.rotationIndex,
  }));

  // Build updates for each weekend queue group; members not in WEEKEND_GROUPS don't affect selection anyway.
  const updates: { memberId: string; newRotationIndex: number }[] = [];
  for (const groupKey of WEEKEND_GROUPS) {
    const queue = getQueueOrder(rotationMembers, groupKey);
    if (queue.length <= 1) continue;

    const n = queue.length;
    for (let i = 0; i < n; i++) {
      const target = queue[i];
      const source = queue[(i - 1 + n) % n]; // back shift: 1st->last
      updates.push({ memberId: target.id, newRotationIndex: source.rotationIndex });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.teamMember.update({
          where: { id: u.memberId },
          data: { rotationIndex: u.newRotationIndex },
        });
      }

      // Clear ALL existing OFF records so we can regenerate from scratch.
      await tx.scheduleAssignment.deleteMany({ where: { scheduleId } });
    });
  } catch {
    return { success: false, error: "Erro ao retroceder fila de rotação." };
  }

  const assignments = await generateMonthlySchedule(schedule.month, schedule.year);
  const payload = assignments.map((a) => ({
    memberId: a.memberId,
    date: a.date,
    status: a.status,
  }));

  const saveResult = await saveScheduleAssignments(scheduleId, payload);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error };
  }

  const sobreavisoWeeks = await getSobreavisoScheduleForMonth(
    schedule.month,
    schedule.year,
    schedule.teamId
  );

  const assignmentsForClient: ScheduleAssignmentRow[] = assignments.map((a) => ({
    id: "",
    scheduleId: schedule.id,
    memberId: a.memberId,
    date: a.date,
    status: a.status,
  }));

  return { success: true, assignments: assignmentsForClient, sobreavisoWeeks };
}


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
import {
  getQueueOrder,
  listMemberGroups,
  type QueueMember,
} from "./queueManager";
import {
  getWeekendCoverageCount,
  resolveScheduleRules,
} from "./resolveScheduleRules";

export type AdminBackCycleRotationQueueForAllMembersResult =
  | { success: true; assignments: ScheduleAssignmentRow[]; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

/**
 * Retrocede ciclicamente o `rotationIndex` em 1 posição por grupo (shift×level)
 * com cobertura > 0:
 * - 1º -> último
 * - 2º -> 1º
 * - 3º -> 2º
 * ...
 * E então regenera a escala do mês atual.
 *
 * `generateAutomaticSchedule` bloqueia quando já existem assignments; por isso
 * limpamos e regeramos direto aqui.
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

  const resolved = await resolveScheduleRules(schedule.teamId);

  const rawRotationMembers = await prisma.teamMember.findMany({
    where: {
      teamId: schedule.teamId,
      participatesInSchedule: true,
    },
    orderBy: [{ rotationIndex: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      teamShiftId: true,
      teamLevelId: true,
      rotationIndex: true,
    },
  });
  const allMembers: QueueMember[] = rawRotationMembers.map((m) => ({
    id: m.id,
    name: m.name,
    teamShiftId: m.teamShiftId,
    teamLevelId: m.teamLevelId,
    rotationIndex: m.rotationIndex,
  }));

  const rotationMembers = allMembers.filter(
    (m) => getWeekendCoverageCount(resolved, m.teamShiftId, m.teamLevelId) > 0
  );

  const updates: { memberId: string; newRotationIndex: number }[] = [];
  for (const { teamShiftId, teamLevelId } of listMemberGroups(rotationMembers)) {
    const queue = getQueueOrder(rotationMembers, teamShiftId, teamLevelId);
    if (queue.length <= 1) continue;

    const n = queue.length;
    for (let i = 0; i < n; i++) {
      const target = queue[i];
      const source = queue[(i - 1 + n) % n];
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

      await tx.scheduleAssignment.deleteMany({ where: { scheduleId } });
    });
  } catch {
    return { success: false, error: "Erro ao retroceder fila de rotação." };
  }

  const assignments = await generateMonthlySchedule(
    schedule.month,
    schedule.year,
    schedule.teamId
  );
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

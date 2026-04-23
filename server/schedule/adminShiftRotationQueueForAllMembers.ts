"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";
import type { ScheduleAssignmentRow } from "@/types/schedule";
import {
  getQueueOrder,
  listMemberGroups,
  type QueueMember,
} from "./queueManager";
import {
  getWeekendCoverageCount,
  resolveScheduleRules,
} from "./resolveScheduleRules";
import { generateMonthlySchedule } from "./generateMonthlySchedule";
import { saveScheduleAssignments } from "./saveScheduleAssignments";

type Direction = 1 | -1;

export type AdminShiftRotationQueueForAllMembersResult =
  | { success: true; assignments: ScheduleAssignmentRow[] }
  | { success: false; error: string };

function computeStepUpdatesForGroup(
  queue: QueueMember[],
  count: number,
  direction: Direction
): { memberId: string; newRotationIndex: number }[] {
  if (count <= 0 || queue.length === 0) return [];

  const take = Math.min(count, queue.length);
  const ordered = queue.slice().sort((a, b) => a.rotationIndex - b.rotationIndex);

  if (direction === 1) {
    const maxIndex = Math.max(0, ...ordered.map((m) => m.rotationIndex));
    const selected = ordered.slice(0, take);
    return selected.map((m, i) => ({
      memberId: m.id,
      newRotationIndex: maxIndex + 1 + i,
    }));
  }

  const minIndex = Math.min(...ordered.map((m) => m.rotationIndex));
  const selected = ordered.slice(ordered.length - take);
  return selected.map((m, i) => ({
    memberId: m.id,
    newRotationIndex: minIndex - take + i,
  }));
}

export async function adminShiftRotationQueueForAllMembers(
  scheduleId: string,
  direction: Direction
): Promise<AdminShiftRotationQueueForAllMembersResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await assertStaffCanMutateSchedule(session, scheduleId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
  }

  if (direction !== 1 && direction !== -1) {
    return { success: false, error: "Direção inválida." };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, month: true, year: true, teamId: true },
  });
  if (!schedule) return { success: false, error: "Escala não encontrada." };

  const resolved = await resolveScheduleRules(schedule.teamId);

  const rawRotationMembers = await prisma.teamMember.findMany({
    where: {
      teamId: schedule.teamId,
      participatesInSchedule: true,
    },
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

  // Só grupos com cobertura > 0 participam do rodízio.
  const rotationMembers = allMembers.filter(
    (m) => getWeekendCoverageCount(resolved, m.teamShiftId, m.teamLevelId) > 0
  );

  const allUpdates: { memberId: string; newRotationIndex: number }[] = [];
  for (const { teamShiftId, teamLevelId } of listMemberGroups(rotationMembers)) {
    const count = getWeekendCoverageCount(resolved, teamShiftId, teamLevelId);
    const groupQueue = getQueueOrder(rotationMembers, teamShiftId, teamLevelId);
    allUpdates.push(...computeStepUpdatesForGroup(groupQueue, count, direction));
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const u of allUpdates) {
        await tx.teamMember.update({
          where: { id: u.memberId },
          data: { rotationIndex: u.newRotationIndex },
        });
      }

      await tx.scheduleAssignment.deleteMany({ where: { scheduleId } });
    });
  } catch {
    return { success: false, error: "Erro ao atualizar fila de rotação." };
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
  if (!saveResult.success) return { success: false, error: saveResult.error };

  const assignmentsForClient: ScheduleAssignmentRow[] = assignments.map((a) => ({
    id: "",
    scheduleId,
    memberId: a.memberId,
    date: a.date,
    status: a.status,
  }));

  return { success: true, assignments: assignmentsForClient };
}

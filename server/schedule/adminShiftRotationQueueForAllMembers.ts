"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";
import type { ScheduleAssignmentRow } from "@/types/schedule";
import {
  WEEKEND_COVERAGE,
  WEEKEND_GROUPS,
  getQueueOrder,
  type GroupKey,
  type QueueMember,
} from "./queueManager";
import { generateMonthlySchedule } from "./generateMonthlySchedule";
import { saveScheduleAssignments } from "./saveScheduleAssignments";

type Direction = 1 | -1;

export type AdminShiftRotationQueueForAllMembersResult =
  | { success: true; assignments: ScheduleAssignmentRow[] }
  | { success: false; error: string };

function computeStepUpdatesForGroup(
  queue: QueueMember[],
  groupKey: GroupKey,
  direction: Direction
): { memberId: string; newRotationIndex: number }[] {
  const count = WEEKEND_COVERAGE[groupKey];
  if (count <= 0 || queue.length === 0) return [];

  const take = Math.min(count, queue.length);
  const ordered = queue.slice().sort((a, b) => a.rotationIndex - b.rotationIndex);

  if (direction === 1) {
    // forward: select first `take`, move them to the end with fresh rotationIndex
    const maxIndex = Math.max(0, ...ordered.map((m) => m.rotationIndex));
    const selected = ordered.slice(0, take);
    return selected.map((m, i) => ({
      memberId: m.id,
      newRotationIndex: maxIndex + 1 + i,
    }));
  }

  // direction === -1
  // reverse: last `take` members (they were the ones moved to end in the last forward step)
  // are moved to the front by assigning them indices < current minimum.
  const minIndex = Math.min(...ordered.map((m) => m.rotationIndex));
  const selected = ordered.slice(ordered.length - take); // keep order (already ascending)
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
    select: { id: true, month: true, year: true },
  });
  if (!schedule) return { success: false, error: "Escala não encontrada." };

  const rotationMembers: QueueMember[] = await prisma.teamMember.findMany({
    where: {
      participatesInSchedule: true,
      level: { in: ["N1", "N2"] },
    },
    select: {
      id: true,
      name: true,
      level: true,
      shift: true,
      rotationIndex: true,
    },
  });

  // Apply a single weekend-step to each shift/level queue group.
  // Forward (+1) consumes the next weekend; reverse (-1) undoes the last consumption.
  const allUpdates: { memberId: string; newRotationIndex: number }[] = [];
  for (const groupKey of WEEKEND_GROUPS) {
    const groupQueue = getQueueOrder(rotationMembers, groupKey);
    allUpdates.push(
      ...computeStepUpdatesForGroup(groupQueue, groupKey, direction)
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const u of allUpdates) {
        await tx.teamMember.update({
          where: { id: u.memberId },
          data: { rotationIndex: u.newRotationIndex },
        });
      }

      // remove all OFF records (WORK is implicit)
      await tx.scheduleAssignment.deleteMany({ where: { scheduleId } });
    });
  } catch {
    return { success: false, error: "Erro ao atualizar fila de rotação." };
  }

  const assignments = await generateMonthlySchedule(schedule.month, schedule.year);
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


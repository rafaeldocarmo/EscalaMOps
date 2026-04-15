"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanMutateSchedule } from "@/server/schedule/assertStaffScheduleAccess";
import type { SwapActionResult } from "@/types/swaps";

/**
 * Admin swaps two members' queue positions (rotationIndex) and their
 * schedule assignments for a given schedule. Instantly applied, no approval flow.
 */
export async function adminSwapQueuePositions(
  memberIdA: string,
  memberIdB: string,
  scheduleId: string
): Promise<SwapActionResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Apenas administradores podem realizar esta ação." };
  }
  try {
    await assertStaffCanMutateSchedule(session, scheduleId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
  }
  if (memberIdA === memberIdB) {
    return { success: false, error: "Selecione dois membros diferentes." };
  }

  const [a, b] = await Promise.all([
    prisma.teamMember.findUnique({ where: { id: memberIdA } }),
    prisma.teamMember.findUnique({ where: { id: memberIdB } }),
  ]);
  if (!a || !b) {
    return { success: false, error: "Membro não encontrado." };
  }

  const sched = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { teamId: true },
  });
  if (!sched?.teamId || a.teamId !== sched.teamId || b.teamId !== sched.teamId) {
    return { success: false, error: "Membros devem pertencer à equipe desta escala." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamMember.update({ where: { id: memberIdA }, data: { rotationIndex: b.rotationIndex } });
    await tx.teamMember.update({ where: { id: memberIdB }, data: { rotationIndex: a.rotationIndex } });

    const schedule = await tx.schedule.findUnique({
      where: { id: scheduleId },
      include: { assignments: true },
    });
    if (!schedule) return;

    const year = schedule.year;
    const month = schedule.month;
    const daysInMonth = new Date(year, month, 0).getDate();

    const statusA = new Map<string, "WORK" | "OFF">();
    const statusB = new Map<string, "WORK" | "OFF">();
    for (const asn of schedule.assignments) {
      const key = `${asn.date.getUTCFullYear()}-${String(asn.date.getUTCMonth() + 1).padStart(2, "0")}-${String(asn.date.getUTCDate()).padStart(2, "0")}`;
      if (asn.memberId === memberIdA) statusA.set(key, asn.status === "OFF" ? "OFF" : "WORK");
      if (asn.memberId === memberIdB) statusB.set(key, asn.status === "OFF" ? "OFF" : "WORK");
    }

    await tx.scheduleAssignment.deleteMany({
      where: { scheduleId, memberId: { in: [memberIdA, memberIdB] } },
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dk = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const date = new Date(dk + "T12:00:00.000Z");
      const oldA = statusA.get(dk) ?? "WORK";
      const oldB = statusB.get(dk) ?? "WORK";
      if (oldB === "OFF") {
        await tx.scheduleAssignment.create({ data: { scheduleId, memberId: memberIdA, date, status: "OFF" } });
      }
      if (oldA === "OFF") {
        await tx.scheduleAssignment.create({ data: { scheduleId, memberId: memberIdB, date, status: "OFF" } });
      }
    }
  });

  return { success: true };
}

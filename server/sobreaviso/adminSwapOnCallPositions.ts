"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, addDays, format } from "date-fns";
import type { SwapActionResult } from "@/types/swaps";
import type { SobreavisoWeek } from "./getSobreavisoScheduleForMonth";

/**
 * Admin swaps two members' on-call queue positions (onCallRotationIndex) and
 * their OnCallAssignment records for the current+next 2 months.
 * Returns the refreshed sobreavisoWeeks for the given month.
 */
export async function adminSwapOnCallPositions(
  memberIdA: string,
  memberIdB: string,
  year: number,
  month: number
): Promise<SwapActionResult & { sobreavisoWeeks?: SobreavisoWeek[] }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem realizar esta ação." };
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

  await prisma.$transaction(async (tx) => {
    await tx.teamMember.update({ where: { id: memberIdA }, data: { onCallRotationIndex: b.onCallRotationIndex } });
    await tx.teamMember.update({ where: { id: memberIdB }, data: { onCallRotationIndex: a.onCallRotationIndex } });

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    const overlapWhere = {
      startDate: { lt: rangeEnd },
      endDate: { gt: rangeStart },
    };

    const [assignmentsA, assignmentsB] = await Promise.all([
      tx.onCallAssignment.findMany({ where: { memberId: memberIdA, ...overlapWhere } }),
      tx.onCallAssignment.findMany({ where: { memberId: memberIdB, ...overlapWhere } }),
    ]);

    for (const asn of assignmentsA) {
      await tx.onCallAssignment.update({ where: { id: asn.id }, data: { memberId: memberIdB } });
    }
    for (const asn of assignmentsB) {
      await tx.onCallAssignment.update({ where: { id: asn.id }, data: { memberId: memberIdA } });
    }
  });

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = addDays(endOfMonth(new Date(year, month - 1)), 1);
  const refreshed = await prisma.onCallAssignment.findMany({
    where: { startDate: { lt: monthEnd }, endDate: { gt: monthStart } },
    include: { member: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  const sobreavisoWeeks: SobreavisoWeek[] = refreshed.map((r) => ({
    id: r.id,
    startDate: format(r.startDate, "yyyy-MM-dd"),
    endDate: format(r.endDate, "yyyy-MM-dd"),
    memberId: r.memberId,
    memberName: r.member.name,
    level: r.level,
  }));

  return { success: true, sobreavisoWeeks };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, format } from "date-fns";
import { resolveSobreavisoTeamScope } from "@/server/sobreaviso/resolveSobreavisoTeamScope";

export interface SobreavisoWeek {
  id: string;
  startDate: string;
  endDate: string;
  memberId: string;
  memberName: string;
  level: string;
}

export async function getSobreavisoScheduleForMonth(
  month: number,
  year: number,
  teamIdParam?: string | null
): Promise<SobreavisoWeek[]> {
  const session = await auth();
  if (!session?.user) return [];

  const scopeTeamId = await resolveSobreavisoTeamScope(teamIdParam);

  const monthStart = startOfMonth(new Date(year, month - 1));
  const nextMonthStart = startOfMonth(new Date(year, month));

  // Assignments são gravados com "T12:00:00.000Z". Usamos esse mesmo marco como fim exclusivo
  // para não puxar o "transição" que cai no dia 1 do próximo mês.
  const monthStartNoonUtc = new Date(format(monthStart, "yyyy-MM-dd") + "T12:00:00.000Z");
  const nextMonthStartNoonUtc = new Date(
    format(nextMonthStart, "yyyy-MM-dd") + "T12:00:00.000Z"
  );

  const assignments = await prisma.onCallAssignment.findMany({
    where: {
      startDate: { lt: nextMonthStartNoonUtc },
      endDate: { gt: monthStartNoonUtc },
      ...(scopeTeamId ? { member: { teamId: scopeTeamId } } : {}),
    },
    include: {
      member: { select: { name: true } },
      teamLevel: { select: { label: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return assignments.map((a) => ({
    id: a.id,
    startDate: format(a.startDate, "yyyy-MM-dd"),
    endDate: format(a.endDate, "yyyy-MM-dd"),
    memberId: a.memberId,
    memberName: a.member.name,
    level: a.teamLevel?.label ?? "",
  }));
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, addDays, format } from "date-fns";

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
  year: number
): Promise<SobreavisoWeek[]> {
  const session = await auth();
  if (!session?.user) return [];

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = addDays(endOfMonth(new Date(year, month - 1)), 1);

  const assignments = await prisma.onCallAssignment.findMany({
    where: {
      startDate: { lt: monthEnd },
      endDate: { gt: monthStart },
    },
    include: {
      member: { select: { name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return assignments.map((a) => ({
    id: a.id,
    startDate: format(a.startDate, "yyyy-MM-dd"),
    endDate: format(a.endDate, "yyyy-MM-dd"),
    memberId: a.memberId,
    memberName: a.member.name,
    level: a.level,
  }));
}

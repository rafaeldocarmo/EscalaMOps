"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, addDays, format } from "date-fns";

export interface OnCallPeriod {
  startDate: string;
  endDate: string;
}

/**
 * Returns on-call periods for a given member in the given month.
 * Requires authenticated user.
 */
export async function getOnCallScheduleForMember(
  memberId: string,
  year: number,
  month: number
): Promise<OnCallPeriod[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = addDays(endOfMonth(new Date(year, month - 1)), 1);

  const assignments = await prisma.onCallAssignment.findMany({
    where: {
      memberId,
      startDate: { lt: monthEnd },
      endDate: { gt: monthStart },
    },
    orderBy: { startDate: "asc" },
  });

  return assignments.map((a) => ({
    startDate: format(a.startDate, "yyyy-MM-dd"),
    endDate: format(a.endDate, "yyyy-MM-dd"),
  }));
}

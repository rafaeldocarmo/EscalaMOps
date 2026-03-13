"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, addDays, format } from "date-fns";

export interface MyOnCallPeriod {
  startDate: string;
  endDate: string;
}

/**
 * Returns the on-call periods for the logged-in member in the given month.
 * Each period has startDate and endDate (YYYY-MM-DD).
 */
export async function getMyOnCallSchedule(
  memberId: string,
  year: number,
  month: number
): Promise<MyOnCallPeriod[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];
  if (session.member.id !== memberId) return [];

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

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { endOfMonth, startOfMonth } from "date-fns";
import {
  getSobreavisoScheduleForMonth,
  type SobreavisoWeek,
} from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

export type ClearSobreavisoForMonthResult =
  | { success: true; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

export async function clearSobreavisoForMonth(
  month: number,
  year: number
): Promise<ClearSobreavisoForMonthResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
  }

  // Ensure schedule exists so client can keep navigating the month.
  await prisma.schedule.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status: "OPEN" },
    update: {},
    select: { id: true },
  });

  try {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));

    // Remove all on-call assignments overlapping this month window.
    await prisma.onCallAssignment.deleteMany({
      where: {
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });

    const sobreavisoWeeks = await getSobreavisoScheduleForMonth(month, year);
    return { success: true, sobreavisoWeeks };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao limpar sobreaviso.";
    return { success: false, error: message };
  }
}


"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function dateToKey(d: Date): string {
  // Use UTC to avoid timezone shifts when mapping stored DateTimes back to YYYY-MM-DD keys.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type MyScheduleDay = { dateKey: string; day: number; status: "WORK" | "OFF" };

export async function getMySchedule(
  memberId: string,
  year: number,
  month: number
): Promise<{ days: MyScheduleDay[]; year: number; month: number } | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;
  if (session.member.id !== memberId) return null;

  const schedule = await prisma.schedule.findUnique({
    where: { year_month: { year, month } },
    include: {
      assignments: {
        where: { memberId },
      },
    },
  });

  if (!schedule) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: MyScheduleDay[] = Array.from({ length: daysInMonth }, (_, i) => ({
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
      day: i + 1,
      status: "WORK" as const,
    }));
    return { days, year, month };
  }

  const statusByDate = new Map<string, "WORK" | "OFF">();
  for (const a of schedule.assignments) {
    const key = dateToKey(a.date);
    statusByDate.set(key, a.status === "OFF" ? "OFF" : "WORK");
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: MyScheduleDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return {
      dateKey,
      day: i + 1,
      status: statusByDate.get(dateKey) ?? "WORK",
    };
  });

  return { days, year, month };
}

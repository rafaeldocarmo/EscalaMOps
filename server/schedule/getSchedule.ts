"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ScheduleRow, ScheduleAssignmentRow } from "@/types/schedule";

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getSchedule(
  month: number,
  year: number
): Promise<{ schedule: ScheduleRow; assignments: ScheduleAssignmentRow[] }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado. Apenas administradores podem acessar a escala.");
  }

  let schedule = await prisma.schedule.findUnique({
    where: { year_month: { year, month } },
    include: { assignments: true },
  });

  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: { month, year, status: "OPEN" },
      include: { assignments: true },
    });
  }

  return {
    schedule: {
      id: schedule.id,
      month: schedule.month,
      year: schedule.year,
      status: schedule.status,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    },
    assignments: schedule.assignments.map((a) => ({
      id: a.id,
      scheduleId: a.scheduleId,
      memberId: a.memberId,
      date: dateToKey(a.date),
      status: a.status,
    })),
  };
}

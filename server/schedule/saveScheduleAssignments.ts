"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SaveAssignmentPayload } from "@/types/schedule";

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00.000Z");
}

export type SaveScheduleAssignmentsResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Saves only OFF days (folgas) for the schedule month. Work days are implicit:
 * any (member, date) without a record is considered WORK.
 */
export async function saveScheduleAssignments(
  scheduleId: string,
  assignments: SaveAssignmentPayload[]
): Promise<SaveScheduleAssignmentsResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) {
    return { success: false, error: "Escala não encontrada." };
  }

  try {
    const monthStart = new Date(schedule.year, schedule.month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(schedule.year, schedule.month, 0, 23, 59, 59, 999);

    const offOnly = assignments.filter((a) => a.status === "OFF");

    await prisma.$transaction([
      prisma.scheduleAssignment.deleteMany({
        where: {
          scheduleId,
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
      offOnly.length > 0
        ? prisma.scheduleAssignment.createMany({
            data: offOnly.map((a) => ({
              scheduleId,
              memberId: a.memberId,
              date: parseDate(a.date),
              status: "OFF" as const,
            })),
          })
        : Promise.resolve(),
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }
}

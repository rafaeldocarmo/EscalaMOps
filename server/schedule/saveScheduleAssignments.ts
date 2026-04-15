"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { SaveAssignmentPayload } from "@/types/schedule";
import { z } from "zod";

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
  if (!session?.user) {
    return { success: false, error: "Acesso negado." };
  }
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const payloadSchema = z.array(
    z.object({
      memberId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
      status: z.enum(["WORK", "OFF", "SWAP_REQUESTED"]),
    })
  );
  const parsedPayload = payloadSchema.safeParse(assignments);
  if (!parsedPayload.success) {
    return { success: false, error: "Payload inválido." };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) {
    return { success: false, error: "Escala não encontrada." };
  }

  if (
    session.user?.role === "ADMIN_TEAM" &&
    session.user.managedTeamId &&
    schedule.teamId !== session.user.managedTeamId
  ) {
    return { success: false, error: "Acesso negado." };
  }

  try {
    const monthStart = new Date(schedule.year, schedule.month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(schedule.year, schedule.month, 0, 23, 59, 59, 999);
    // Use date range from payload when present, so straddling weekend (Sat last day + Sun next month) is included
    let dateMin = monthStart;
    let dateMax = monthEnd;
    const safeAssignments = parsedPayload.data;
    if (safeAssignments.length > 0) {
      const dates = safeAssignments.map((a) => parseDate(a.date));
      dateMin = new Date(Math.min(...dates.map((d) => d.getTime())));
      dateMax = new Date(Math.max(...dates.map((d) => d.getTime())));
      dateMin.setHours(0, 0, 0, 0);
      dateMax.setHours(23, 59, 59, 999);
    }

    const offOnly = safeAssignments.filter((a) => a.status === "OFF");

    await prisma.$transaction(async (tx) => {
      await tx.scheduleAssignment.deleteMany({
        where: {
          scheduleId,
          date: { gte: dateMin, lte: dateMax },
        },
      });
      if (offOnly.length > 0) {
        await tx.scheduleAssignment.createMany({
          data: offOnly.map((a) => ({
            scheduleId,
            memberId: a.memberId,
            date: parseDate(a.date),
            status: "OFF" as const,
          })),
        });
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }
}

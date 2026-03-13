"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";

function dateKeyToDate(dateKey: string): Date {
  return new Date(dateKey + "T12:00:00.000Z");
}

/**
 * Swap schedule assignments between two members for a given schedule (month).
 */
async function swapAssignmentsInSchedule(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  scheduleId: string,
  memberA: string,
  memberB: string
) {
  const schedule = await tx.schedule.findUnique({
    where: { id: scheduleId },
    include: { assignments: true },
  });
  if (!schedule) return;

  const year = schedule.year;
  const month = schedule.month;
  const daysInMonth = new Date(year, month, 0).getDate();

  const statusA = new Map<string, "WORK" | "OFF">();
  const statusB = new Map<string, "WORK" | "OFF">();
  for (const a of schedule.assignments) {
    const key = `${a.date.getUTCFullYear()}-${String(a.date.getUTCMonth() + 1).padStart(2, "0")}-${String(a.date.getUTCDate()).padStart(2, "0")}`;
    if (a.memberId === memberA) statusA.set(key, a.status === "OFF" ? "OFF" : "WORK");
    if (a.memberId === memberB) statusB.set(key, a.status === "OFF" ? "OFF" : "WORK");
  }

  await tx.scheduleAssignment.deleteMany({
    where: {
      scheduleId,
      memberId: { in: [memberA, memberB] },
    },
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = dateKeyToDate(dateKey);
    const oldA = statusA.get(dateKey) ?? "WORK";
    const oldB = statusB.get(dateKey) ?? "WORK";
    if (oldB === "OFF") {
      await tx.scheduleAssignment.create({
        data: { scheduleId, memberId: memberA, date, status: "OFF" },
      });
    }
    if (oldA === "OFF") {
      await tx.scheduleAssignment.create({
        data: { scheduleId, memberId: memberB, date, status: "OFF" },
      });
    }
  }
}

/**
 * Admin approves a swap request.
 * OFF_SWAP: set originalDate to WORK (remove OFF), targetDate to OFF (create OFF).
 * QUEUE_SWAP: swap rotationIndex and swap schedule assignments (current + next month) between requester and target.
 */
export async function approveSwap(swapRequestId: string): Promise<SwapActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem aprovar." };
  }

  const swap = await prisma.scheduleSwapRequest.findUnique({
    where: { id: swapRequestId },
    include: { requester: true, targetMember: true },
  });

  if (!swap) {
    return { success: false, error: "Solicitação não encontrada." };
  }
  if (swap.status === "APPROVED") {
    return { success: false, error: "Esta solicitação já foi aprovada." };
  }
  if (swap.status === "REJECTED" || swap.status === "CANCELLED") {
    return { success: false, error: "Esta solicitação não pode mais ser aprovada." };
  }
  if ((swap.type === "QUEUE_SWAP" || swap.type === "ONCALL_SWAP") && swap.status !== "SECOND_USER_ACCEPTED") {
    return { success: false, error: "O outro membro ainda precisa aceitar a troca." };
  }
  if (swap.type === "OFF_SWAP" && swap.status !== "PENDING") {
    return { success: false, error: "Status inválido para aprovação." };
  }

  await prisma.$transaction(async (tx) => {
    if (swap.type === "OFF_SWAP" && swap.originalDate && swap.targetDate) {
      const orig = swap.originalDate;
      const targ = swap.targetDate;
      const yearOrig = orig.getUTCFullYear();
      const monthOrig = orig.getUTCMonth() + 1;
      const yearTarg = targ.getUTCFullYear();
      const monthTarg = targ.getUTCMonth() + 1;

      const [schedOrig, schedTarg] = await Promise.all([
        tx.schedule.findUnique({ where: { year_month: { year: yearOrig, month: monthOrig } } }),
        tx.schedule.findUnique({ where: { year_month: { year: yearTarg, month: monthTarg } } }),
      ]);

      if (schedOrig && schedTarg) {
        await tx.scheduleAssignment.deleteMany({
          where: {
            scheduleId: schedOrig.id,
            memberId: swap.requesterId,
            date: orig,
            status: "OFF",
          },
        });
        await tx.scheduleAssignment.create({
          data: {
            scheduleId: schedTarg.id,
            memberId: swap.requesterId,
            date: targ,
            status: "OFF",
          },
        });
      }
    }

    if (swap.type === "QUEUE_SWAP" && swap.targetMemberId) {
      const requester = swap.requester;
      const target = swap.targetMember!;
      const a = requester.rotationIndex;
      const b = target.rotationIndex;
      await tx.teamMember.update({ where: { id: swap.requesterId }, data: { rotationIndex: b } });
      await tx.teamMember.update({ where: { id: swap.targetMemberId }, data: { rotationIndex: a } });

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

      const [schedCurr, schedNext] = await Promise.all([
        tx.schedule.findUnique({ where: { year_month: { year: currentYear, month: currentMonth } } }),
        tx.schedule.findUnique({ where: { year_month: { year: nextYear, month: nextMonth } } }),
      ]);
      if (schedCurr) {
        await swapAssignmentsInSchedule(tx, schedCurr.id, swap.requesterId, swap.targetMemberId);
      }
      if (schedNext) {
        await swapAssignmentsInSchedule(tx, schedNext.id, swap.requesterId, swap.targetMemberId);
      }
    }

    if (swap.type === "ONCALL_SWAP" && swap.targetMemberId) {
      const requester = swap.requester;
      const target = swap.targetMember!;
      const aIdx = requester.onCallRotationIndex;
      const bIdx = target.onCallRotationIndex;
      await tx.teamMember.update({ where: { id: swap.requesterId }, data: { onCallRotationIndex: bIdx } });
      await tx.teamMember.update({ where: { id: swap.targetMemberId }, data: { onCallRotationIndex: aIdx } });

      const now = new Date();
      const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);

      const overlapWhere = {
        startDate: { lt: rangeEnd },
        endDate: { gt: rangeStart },
      };

      const [assignmentsA, assignmentsB] = await Promise.all([
        tx.onCallAssignment.findMany({
          where: { memberId: swap.requesterId, ...overlapWhere },
        }),
        tx.onCallAssignment.findMany({
          where: { memberId: swap.targetMemberId, ...overlapWhere },
        }),
      ]);

      for (const a of assignmentsA) {
        await tx.onCallAssignment.update({ where: { id: a.id }, data: { memberId: swap.targetMemberId } });
      }
      for (const b of assignmentsB) {
        await tx.onCallAssignment.update({ where: { id: b.id }, data: { memberId: swap.requesterId } });
      }
    }

    await tx.scheduleSwapRequest.update({
      where: { id: swapRequestId },
      data: { status: "APPROVED", adminApprovedAt: new Date() },
    });
  });

  return { success: true };
}

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

export type MemberScheduleDay = { dateKey: string; day: number; status: "WORK" | "OFF" };

/** Admin-only: get a member's schedule for a given month (for swap review). */
export async function getMemberScheduleForAdmin(
  memberId: string,
  year: number,
  month: number
): Promise<{ days: MemberScheduleDay[]; year: number; month: number } | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return null;

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
    const days: MemberScheduleDay[] = Array.from({ length: daysInMonth }, (_, i) => ({
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
  const days: MemberScheduleDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return {
      dateKey,
      day: i + 1,
      status: statusByDate.get(dateKey) ?? "WORK",
    };
  });

  return { days, year, month };
}

/** For swap preview: get another member's schedule (allowed only if same level+shift). */
export async function getMemberScheduleForSwapPreview(
  otherMemberId: string,
  year: number,
  month: number
): Promise<{ days: MemberScheduleDay[]; year: number; month: number } | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;
  if (session.member.id === otherMemberId) return null;

  const [myMember, otherMember] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { id: session.member.id },
      select: { level: true, shift: true },
    }),
    prisma.teamMember.findUnique({
      where: { id: otherMemberId },
      select: { level: true, shift: true },
    }),
  ]);
  if (!myMember || !otherMember) return null;
  if (myMember.level !== otherMember.level || myMember.shift !== otherMember.shift) return null;

  const schedule = await prisma.schedule.findUnique({
    where: { year_month: { year, month } },
    include: {
      assignments: {
        where: { memberId: otherMemberId },
      },
    },
  });

  if (!schedule) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: MemberScheduleDay[] = Array.from({ length: daysInMonth }, (_, i) => ({
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
  const days: MemberScheduleDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return {
      dateKey,
      day: i + 1,
      status: statusByDate.get(dateKey) ?? "WORK",
    };
  });

  return { days, year, month };
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

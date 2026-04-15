"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultTeam, resolveTeamIdForRead } from "@/lib/multiTeam";
import type { ScheduleRow, ScheduleAssignmentRow } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getMonthlySchedule(
  year: number,
  month: number,
  teamId?: string
): Promise<{
  schedule: ScheduleRow | null;
  assignments: ScheduleAssignmentRow[];
  members: TeamMemberRow[];
} | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const explicitTeamId = await resolveTeamIdForRead(teamId);
  const scheduleTeamId = explicitTeamId ?? (await getDefaultTeam())?.id ?? null;

  const schedule = scheduleTeamId
    ? await prisma.schedule.findUnique({
        where: { teamId_year_month: { teamId: scheduleTeamId, year, month } },
        include: { assignments: true },
      })
    : await prisma.schedule.findFirst({
        where: { year, month },
        include: { assignments: true },
      });

  if (!schedule) {
    const members = await prisma.teamMember.findMany({
      where: {
        ...(scheduleTeamId ? { teamId: scheduleTeamId } : {}),
        participatesInSchedule: true,
      },
      orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
    });
    const daysInMonth = new Date(year, month, 0).getDate();
    const assignments: ScheduleAssignmentRow[] = [];
    for (const m of members) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        assignments.push({
          id: "",
          scheduleId: "",
          memberId: m.id,
          date: dateKey,
          status: "WORK",
        });
      }
    }
    return {
      schedule: null,
      assignments,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        level: m.level,
        shift: m.shift,
        sobreaviso: m.sobreaviso,
        participatesInSchedule: m.participatesInSchedule,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    };
  }

  const members = await prisma.teamMember.findMany({
    where: {
      ...(scheduleTeamId ? { teamId: scheduleTeamId } : {}),
      participatesInSchedule: true,
    },
    orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
  });

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
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      level: m.level,
      shift: m.shift,
      sobreaviso: m.sobreaviso,
      participatesInSchedule: m.participatesInSchedule,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
  };
}

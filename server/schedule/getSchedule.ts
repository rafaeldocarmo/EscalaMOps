"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
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
  if (!isStaffAdmin(session)) return null;

  const memberRow = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { teamId: true },
  });

  if (
    session?.user?.role === "ADMIN_TEAM" &&
    session.user.managedTeamId &&
    memberRow?.teamId !== session.user.managedTeamId
  ) {
    return null;
  }
  const schedule = memberRow?.teamId
    ? await prisma.schedule.findUnique({
        where: { teamId_year_month: { teamId: memberRow.teamId, year, month } },
        include: {
          assignments: {
            where: { memberId },
          },
        },
      })
    : await prisma.schedule.findFirst({
        where: { year, month },
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
      select: { teamLevelId: true, teamShiftId: true },
    }),
    prisma.teamMember.findUnique({
      where: { id: otherMemberId },
      select: { teamLevelId: true, teamShiftId: true },
    }),
  ]);
  if (!myMember || !otherMember) return null;
  if (myMember.teamLevelId !== otherMember.teamLevelId || myMember.teamShiftId !== otherMember.teamShiftId) return null;

  const otherRow = await prisma.teamMember.findUnique({
    where: { id: otherMemberId },
    select: { teamId: true },
  });
  const schedule = otherRow?.teamId
    ? await prisma.schedule.findUnique({
        where: { teamId_year_month: { teamId: otherRow.teamId, year, month } },
        include: {
          assignments: {
            where: { memberId: otherMemberId },
          },
        },
      })
    : await prisma.schedule.findFirst({
        where: { year, month },
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
  year: number,
  teamId?: string
): Promise<{ schedule: ScheduleRow; assignments: ScheduleAssignmentRow[] }> {
  const session = await auth();
  if (!isStaffAdmin(session) || !session?.user) {
    throw new Error("Acesso negado. Apenas administradores podem acessar a escala.");
  }

  let resolvedTeamId: string;
  try {
    resolvedTeamId = await resolveTeamIdForWriteForSession(session, teamId);
  } catch {
    log({
      level: "warn",
      event: "schedule.get.no_default_team",
      data: { year, month },
    });
    throw new Error(
      "Não foi possível criar a escala: cadastre uma equipe e defina uma como padrão (is_default)."
    );
  }

  log({
    level: "info",
    event: "schedule.get",
    data: { year, month, actorRole: session.user.role, teamId: resolvedTeamId },
  });

  // upsert evita P2002 em (team_id, year, month) quando duas requisições
  // passam pelo find quase ao mesmo tempo e ambas tentam create.
  const schedule = await prisma.schedule.upsert({
    where: {
      teamId_year_month: { teamId: resolvedTeamId, year, month },
    },
    create: {
      teamId: resolvedTeamId,
      month,
      year,
      status: "OPEN",
    },
    update: {},
    include: { assignments: true },
  });
  log({
    level: "info",
    event: "schedule.get.ensure",
    data: { year, month, scheduleId: schedule.id, teamId: resolvedTeamId },
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
  };
}

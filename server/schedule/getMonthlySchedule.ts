"use server";

import { auth } from "@/auth";
import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
import { prisma } from "@/lib/prisma";
import { getDefaultTeam, resolveTeamIdForRead } from "@/lib/multiTeam";
import { loadMemberFormCatalogForTeam } from "@/server/team/loadMemberFormCatalogForTeam";
import {
  getWeekendCoverageCount,
  resolveScheduleRules,
} from "@/server/schedule/resolveScheduleRules";
import type { ScheduleRow, ScheduleAssignmentRow } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";

const memberSelect = {
  id: true,
  name: true,
  phone: true,
  teamId: true,
  teamLevelId: true,
  teamShiftId: true,
  rotationIndex: true,
  teamLevel: { select: { label: true } },
  teamShift: { select: { label: true } },
  sobreaviso: true,
  participatesInSchedule: true,
  createdAt: true,
  updatedAt: true,
} as const;

type RawMember = {
  id: string;
  name: string;
  phone: string;
  teamId: string;
  teamLevelId: string;
  teamShiftId: string;
  rotationIndex: number;
  teamLevel: { label: string };
  teamShift: { label: string };
  sobreaviso: boolean;
  participatesInSchedule: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function weekendRotationByMemberIdForTeam(teamId: string | null): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (!teamId) return map;
  const resolved = await resolveScheduleRules(teamId);
  const members = await prisma.teamMember.findMany({
    where: { teamId, participatesInSchedule: true },
    select: { id: true, teamShiftId: true, teamLevelId: true },
  });
  for (const m of members) {
    map.set(
      m.id,
      getWeekendCoverageCount(resolved, m.teamShiftId, m.teamLevelId) > 0
    );
  }
  return map;
}

function toTeamMemberRow(m: RawMember, weekendRotationById: Map<string, boolean>): TeamMemberRow {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    teamLevelId: m.teamLevelId,
    teamShiftId: m.teamShiftId,
    levelLabel: m.teamLevel.label,
    shiftLabel: m.teamShift.label,
    rotationIndex: m.rotationIndex,
    weekendRotation: weekendRotationById.get(m.id) ?? true,
    sobreaviso: m.sobreaviso,
    participatesInSchedule: m.participatesInSchedule,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

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
  memberFormCatalog: MemberFormCatalog | null;
} | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const explicitTeamId = await resolveTeamIdForRead(teamId);
  const scheduleTeamId = explicitTeamId ?? (await getDefaultTeam())?.id ?? null;

  const memberWhere = {
    ...(scheduleTeamId ? { teamId: scheduleTeamId } : {}),
    participatesInSchedule: true,
  };

  const memberOrder = [
    { teamLevel: { sortOrder: "asc" } } as const,
    { teamShift: { sortOrder: "asc" } } as const,
    { rotationIndex: "asc" } as const,
    { name: "asc" } as const,
  ];

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
      where: memberWhere,
      select: memberSelect,
      orderBy: memberOrder,
    });
    const daysInMonth = new Date(year, month, 0).getDate();
    const assignments: ScheduleAssignmentRow[] = [];
    for (const m of members) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        assignments.push({ id: "", scheduleId: "", memberId: m.id, date: dateKey, status: "WORK" });
      }
    }
    const memberFormCatalog = scheduleTeamId ? await loadMemberFormCatalogForTeam(scheduleTeamId) : null;
    const rulesTeamId = scheduleTeamId ?? members[0]?.teamId ?? null;
    const weekendRotationById = await weekendRotationByMemberIdForTeam(rulesTeamId);
    return {
      schedule: null,
      assignments,
      memberFormCatalog,
      members: members.map((m) => toTeamMemberRow(m, weekendRotationById)),
    };
  }

  const members = await prisma.teamMember.findMany({
    where: memberWhere,
    select: memberSelect,
    orderBy: memberOrder,
  });

  const memberFormCatalog = scheduleTeamId ? await loadMemberFormCatalogForTeam(scheduleTeamId) : null;
  const rulesTeamId = scheduleTeamId ?? members[0]?.teamId ?? null;
  const weekendRotationById = await weekendRotationByMemberIdForTeam(rulesTeamId);

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
    members: members.map((m) => toTeamMemberRow(m, weekendRotationById)),
    memberFormCatalog,
  };
}

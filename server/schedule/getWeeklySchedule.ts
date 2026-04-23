"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultTeam } from "@/lib/multiTeam";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEK_STARTS_ON = 1; // Monday

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateToKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type WeeklyDay = {
  dateKey: string;
  weekdayLabel: string;
  dayLabel: string;
};

type WeeklyCell = {
  shift: string;
  level: string;
  names: string[];
};

type WeeklyScheduleRow = {
  shift: string;
  level: string;
  days: WeeklyCell[];
};

export async function getWeeklySchedule(): Promise<{
  weekDays: WeeklyDay[];
  rows: WeeklyScheduleRow[];
} | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });

  const weekDays: WeeklyDay[] = [];
  let d = new Date(weekStart);
  while (d <= weekEnd) {
    const weekdayLong = format(d, "EEEE", { locale: ptBR });
    const weekdayLabel = weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1);
    weekDays.push({
      dateKey: dateToKey(d),
      weekdayLabel,
      dayLabel: String(d.getDate()).padStart(2, "0"),
    });
    d = addDays(d, 1);
  }

  const monthStart = weekStart.getMonth() + 1;
  const yearStart = weekStart.getFullYear();
  const monthEnd = weekEnd.getMonth() + 1;
  const yearEnd = weekEnd.getFullYear();

  const defaultTeam = await getDefaultTeam();
  const scheduleIds: string[] = [];
  const s1 = defaultTeam
    ? await prisma.schedule.findUnique({
        where: { teamId_year_month: { teamId: defaultTeam.id, year: yearStart, month: monthStart } },
        select: { id: true },
      })
    : await prisma.schedule.findFirst({
        where: { year: yearStart, month: monthStart },
        select: { id: true },
      });
  if (s1) scheduleIds.push(s1.id);
  if (yearEnd !== yearStart || monthEnd !== monthStart) {
    const s2 = defaultTeam
      ? await prisma.schedule.findUnique({
          where: { teamId_year_month: { teamId: defaultTeam.id, year: yearEnd, month: monthEnd } },
          select: { id: true },
        })
      : await prisma.schedule.findFirst({
          where: { year: yearEnd, month: monthEnd },
          select: { id: true },
        });
    if (s2) scheduleIds.push(s2.id);
  }

  const members = await prisma.teamMember.findMany({
    where: { participatesInSchedule: true },
    orderBy: [
      { teamLevel: { sortOrder: "asc" } },
      { teamShift: { sortOrder: "asc" } },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      teamLevelId: true,
      teamShiftId: true,
      teamLevel: { select: { label: true, sortOrder: true } },
      teamShift: { select: { label: true, sortOrder: true } },
    },
  });

  // Build ordered groups from distinct (teamLevelId, teamShiftId) pairs
  const seenGroups = new Set<string>();
  const orderedGroups: { level: string; shift: string; key: string }[] = [];
  for (const m of members) {
    const key = `${m.teamLevelId}_${m.teamShiftId}`;
    if (!seenGroups.has(key)) {
      seenGroups.add(key);
      orderedGroups.push({
        level: m.teamLevel.label,
        shift: m.teamShift.label,
        key,
      });
    }
  }

  if (scheduleIds.length === 0) {
    return {
      weekDays,
      rows: orderedGroups.map((g) => ({
        shift: g.shift,
        level: g.level,
        days: weekDays.map(() => ({ shift: g.shift, level: g.level, names: [] })),
      })),
    };
  }

  const offAssignments = await prisma.scheduleAssignment.findMany({
    where: {
      scheduleId: { in: scheduleIds },
      date: { gte: weekStart, lte: weekEnd },
      status: "OFF",
    },
    select: { memberId: true, date: true },
  });

  const offSet = new Set<string>();
  for (const a of offAssignments) {
    offSet.add(`${dateToKeyUTC(a.date)}|${a.memberId}`);
  }

  const byDayByGroup = new Map<string, Map<string, string[]>>();
  for (const day of weekDays) {
    byDayByGroup.set(day.dateKey, new Map());
    for (const g of orderedGroups) {
      byDayByGroup.get(day.dateKey)!.set(g.key, []);
    }
  }

  for (const member of members) {
    const groupKey = `${member.teamLevelId}_${member.teamShiftId}`;
    const name = member.name.trim();
    const parts = name.split(/\s+/);
    const displayName = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
    for (const day of weekDays) {
      const key = `${day.dateKey}|${member.id}`;
      if (offSet.has(key)) continue;
      const dayMap = byDayByGroup.get(day.dateKey);
      if (dayMap) {
        const arr = dayMap.get(groupKey) ?? [];
        arr.push(displayName);
        dayMap.set(groupKey, arr);
      }
    }
  }

  const rows: WeeklyScheduleRow[] = orderedGroups.map((g) => ({
    shift: g.shift,
    level: g.level,
    days: weekDays.map((day) => ({
      shift: g.shift,
      level: g.level,
      names: byDayByGroup.get(day.dateKey)?.get(g.key) ?? [],
    })),
  }));

  return { weekDays, rows };
}

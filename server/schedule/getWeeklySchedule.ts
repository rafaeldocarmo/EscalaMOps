"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEK_STARTS_ON = 1; // Monday

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Usar para datas vindas do banco (UTC) para evitar deslocamento por fuso. */
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

  const scheduleIds: string[] = [];
  const s1 = await prisma.schedule.findUnique({
    where: { year_month: { year: yearStart, month: monthStart } },
    select: { id: true },
  });
  if (s1) scheduleIds.push(s1.id);
  if (yearEnd !== yearStart || monthEnd !== monthStart) {
    const s2 = await prisma.schedule.findUnique({
      where: { year_month: { year: yearEnd, month: monthEnd } },
      select: { id: true },
    });
    if (s2) scheduleIds.push(s2.id);
  }

  const levels = ["N1", "N2"];
  const shifts = ["T1", "T2", "T3"];
  const orderedGroups: { shift: string; level: string }[] = [];
  for (const level of levels) {
    for (const shift of shifts) {
      if (level === "N2" && shift === "T3") continue;
      orderedGroups.push({ level, shift });
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

  const members = await prisma.teamMember.findMany({
    orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
    select: { id: true, name: true, level: true, shift: true },
  });

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
      byDayByGroup.get(day.dateKey)!.set(`${g.level}_${g.shift}`, []);
    }
  }

  for (const member of members) {
    const groupKey = `${member.level}_${member.shift}`;
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
      names: byDayByGroup.get(day.dateKey)?.get(`${g.level}_${g.shift}`) ?? [],
    })),
  }));

  return { weekDays, rows };
}

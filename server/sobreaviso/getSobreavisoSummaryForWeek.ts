"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addDays, format, startOfWeek } from "date-fns";
import type { Level } from "@/lib/generated/prisma/enums";

const WEEK_STARTS_ON = 1; // Monday
const NOON_UTC = "T12:00:00.000Z";
const ON_CALL_LEVELS: Level[] = ["N2", "ESPC", "PRODUCAO"];

export interface OnCallSummaryForWeek {
  level: Level;
  memberNames: string[];
}

function noonUtc(d: Date): Date {
  return new Date(format(d, "yyyy-MM-dd") + NOON_UTC);
}

export interface OnCallSummaryByWeekPart {
  weekSummary: OnCallSummaryForWeek[]; // Mon-Fri
  weekendSummary: OnCallSummaryForWeek[]; // Sat-Sun
}

/**
 * Split current week on-call summary into:
 * - "weekSummary": Monday-Friday
 * - "weekendSummary": Saturday-Sunday
 *
 * Uses noon-UTC overlap so boundaries don't shift by timezone.
 */
export async function getSobreavisoSummaryForWeek(): Promise<OnCallSummaryByWeekPart> {
  const session = await auth();
  if (!session?.user) return { weekSummary: [], weekendSummary: [] };

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  // exclusive end: next Monday
  const nextWeekStart = addDays(weekStart, 7);

  const weekStartNoon = noonUtc(weekStart);
  const nextWeekStartNoon = noonUtc(nextWeekStart);

  // Split:
  // - weekSummary: Segunda -> Quinta (Mon-Thu): [Mon, Fri)
  // - weekendSummary: Sexta -> Domingo (Fri-Sun): [Fri, Mon)
  const friday = addDays(weekStart, 4);
  const fridayNoon = noonUtc(friday);

  const weekendAssignments = await prisma.onCallAssignment.findMany({
    where: {
      level: { in: ON_CALL_LEVELS },
      startDate: { lt: nextWeekStartNoon }, // end exclusive at next Monday
      endDate: { gt: fridayNoon }, // overlaps Fri-Sun
    },
    include: { member: { select: { name: true } } },
  });

  const weekAssignments = await prisma.onCallAssignment.findMany({
    where: {
      level: { in: ON_CALL_LEVELS },
      startDate: { lt: fridayNoon }, // end exclusive at Friday
      endDate: { gt: weekStartNoon }, // overlaps Mon-Thu
    },
    include: { member: { select: { name: true } } },
  });

  function toSummary(assignments: typeof weekendAssignments): OnCallSummaryForWeek[] {
    const byLevel = new Map<Level, Set<string>>();
    for (const lvl of ON_CALL_LEVELS) byLevel.set(lvl, new Set());

    for (const a of assignments) {
      byLevel.get(a.level)?.add(a.member.name);
    }

    return ON_CALL_LEVELS.filter((lvl) => (byLevel.get(lvl)?.size ?? 0) > 0).map(
      (lvl) => ({
        level: lvl,
        memberNames: Array.from(byLevel.get(lvl) ?? []).sort((x, y) =>
          x.localeCompare(y, "pt-BR")
        ),
      })
    );
  }

  return {
    weekSummary: toSummary(weekAssignments),
    weekendSummary: toSummary(weekendAssignments),
  };
}


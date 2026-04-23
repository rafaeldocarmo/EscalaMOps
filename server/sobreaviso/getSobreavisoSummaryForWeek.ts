"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addDays, format, startOfWeek } from "date-fns";

const WEEK_STARTS_ON = 1; // Monday
const NOON_UTC = "T12:00:00.000Z";

export interface OnCallSummaryForWeek {
  level: string;
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
 * Groups by teamLevel.label (catalog level name), falling back to level enum.
 */
export async function getSobreavisoSummaryForWeek(): Promise<OnCallSummaryByWeekPart> {
  const session = await auth();
  if (!session?.user) return { weekSummary: [], weekendSummary: [] };

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const nextWeekStart = addDays(weekStart, 7);

  const weekStartNoon = noonUtc(weekStart);
  const nextWeekStartNoon = noonUtc(nextWeekStart);

  const friday = addDays(weekStart, 4);
  const fridayNoon = noonUtc(friday);

  const [weekendAssignments, weekAssignments] = await Promise.all([
    prisma.onCallAssignment.findMany({
      where: {
        startDate: { lt: nextWeekStartNoon },
        endDate: { gt: fridayNoon },
      },
      include: {
        member: { select: { name: true } },
        teamLevel: { select: { label: true } },
      },
    }),
    prisma.onCallAssignment.findMany({
      where: {
        startDate: { lt: fridayNoon },
        endDate: { gt: weekStartNoon },
      },
      include: {
        member: { select: { name: true } },
        teamLevel: { select: { label: true } },
      },
    }),
  ]);

  function toSummary(
    assignments: { member: { name: string }; teamLevel: { label: string } | null }[],
  ): OnCallSummaryForWeek[] {
    const byLevel = new Map<string, Set<string>>();

    for (const a of assignments) {
      const lvl = a.teamLevel?.label ?? "—";
      if (!byLevel.has(lvl)) byLevel.set(lvl, new Set());
      byLevel.get(lvl)!.add(a.member.name);
    }

    return Array.from(byLevel.entries())
      .filter(([, names]) => names.size > 0)
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([lvl, names]) => ({
        level: lvl,
        memberNames: Array.from(names).sort((x, y) => x.localeCompare(y, "pt-BR")),
      }));
  }

  return {
    weekSummary: toSummary(weekAssignments),
    weekendSummary: toSummary(weekendAssignments),
  };
}

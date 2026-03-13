import {
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  getDay,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Level } from "@/lib/generated/prisma/enums";

export interface OnCallWeek {
  startDate: string;
  endDate: string;
  memberId: string;
  memberName: string;
  level: Level;
}

const FRIDAY = 5;

interface OnCallQueueMember {
  id: string;
  name: string;
  level: Level;
  onCallRotationIndex: number;
}

/**
 * Find the Friday on or before a given date.
 * If the date IS a Friday, returns it; otherwise walks back to the previous Friday.
 */
function fridayOnOrBefore(date: Date): Date {
  const dow = getDay(date);
  const diff = (dow - FRIDAY + 7) % 7;
  return diff === 0 ? new Date(date) : subDays(date, diff);
}

/**
 * Get all Friday boundaries that cover the entire month.
 * Starts from the Friday on or before day 1, ends at the first Friday after month end.
 */
function getFridayBoundaries(year: number, month: number): Date[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const first = fridayOnOrBefore(monthStart);
  const fridays: Date[] = [];
  let d = new Date(first);
  while (d <= monthEnd) {
    fridays.push(new Date(d));
    d = addDays(d, 7);
  }
  fridays.push(new Date(d));
  return fridays;
}

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getOnCallQueue(members: OnCallQueueMember[], level: Level): OnCallQueueMember[] {
  return members
    .filter((m) => m.level === level)
    .sort((a, b) => a.onCallRotationIndex - b.onCallRotationIndex);
}

function selectNextAndAdvance(
  queue: OnCallQueueMember[]
): { selected: OnCallQueueMember; newIndex: number } | null {
  if (queue.length === 0) return null;
  const selected = queue[0];
  const maxIndex = Math.max(0, ...queue.map((m) => m.onCallRotationIndex));
  return { selected, newIndex: maxIndex + 1 };
}

/**
 * Generate the sobreaviso (on-call) schedule for the given month.
 *
 * Covers every day of the month, including the initial days before the first Friday
 * (carried from the previous month's last Friday boundary).
 *
 * Each period runs Friday -> next Friday.
 * Queue order persists across months via onCallRotationIndex.
 */
export async function generateSobreavisoSchedule(
  month: number,
  year: number
): Promise<OnCallWeek[]> {
  const eligibleMembers = await prisma.teamMember.findMany({
    where: {
      sobreaviso: true,
      level: { in: ["N2", "ESPC"] },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  const queueMembers: OnCallQueueMember[] = eligibleMembers.map((m) => ({
    id: m.id,
    name: m.name,
    level: m.level as Level,
    onCallRotationIndex: m.onCallRotationIndex,
  }));

  const fridays = getFridayBoundaries(year, month);
  if (fridays.length < 2) return [];

  const levels: Level[] = ["N2", "ESPC"];
  const result: OnCallWeek[] = [];
  const rotationUpdates = new Map<string, number>();

  for (let i = 0; i < fridays.length - 1; i++) {
    const periodStart = fridays[i];
    const periodEnd = fridays[i + 1];

    for (const level of levels) {
      const queue = getOnCallQueue(queueMembers, level);
      const pick = selectNextAndAdvance(queue);
      if (!pick) continue;

      const { selected, newIndex } = pick;

      result.push({
        startDate: toDateKey(periodStart),
        endDate: toDateKey(periodEnd),
        memberId: selected.id,
        memberName: selected.name,
        level,
      });

      rotationUpdates.set(selected.id, newIndex);
      selected.onCallRotationIndex = newIndex;
    }
  }

  const monthStart = startOfMonth(new Date(year, month - 1));
  const lastFriday = fridays[fridays.length - 1];

  await prisma.onCallAssignment.deleteMany({
    where: {
      OR: [
        { startDate: { gte: monthStart, lt: lastFriday } },
        { startDate: { lt: monthStart }, endDate: { gt: monthStart } },
      ],
    },
  });

  for (const week of result) {
    await prisma.onCallAssignment.create({
      data: {
        memberId: week.memberId,
        level: week.level,
        startDate: new Date(week.startDate + "T12:00:00.000Z"),
        endDate: new Date(week.endDate + "T12:00:00.000Z"),
      },
    });
  }

  for (const [memberId, newIndex] of rotationUpdates) {
    await prisma.teamMember.update({
      where: { id: memberId },
      data: { onCallRotationIndex: newIndex },
    });
  }

  return result;
}

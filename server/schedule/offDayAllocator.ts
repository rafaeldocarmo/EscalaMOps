import { addDays, subDays, format } from "date-fns";

const MAX_OFF_PER_DAY = 5;

/** Assignment shape used for allocation (date as YYYY-MM-DD). */
export interface ScheduleAssignmentInput {
  memberId: string;
  date: string;
  status: "WORK" | "OFF" | "SWAP_REQUESTED";
}

/** Minimal member shape for shift/level. */
export interface MemberForAllocation {
  id: string;
  shift: string;
  level: string;
}

/** One weekend and the set of member IDs who work it. */
export interface WeekendWithWorkers {
  saturday: Date;
  workerIds: Set<string>;
}

/**
 * Priority days for the week BEFORE the weekend (closest to weekend first).
 * Order: Friday → Thursday → Wednesday → Tuesday → Monday.
 */
export function getBeforeWeekendPriorityDays(saturday: Date): Date[] {
  const monday = subDays(saturday, 5); // Monday of the week containing this Saturday
  const friday = addDays(monday, 4);
  return [
    friday,    // 1st
    subDays(friday, 1),  // Thursday
    subDays(friday, 2),  // Wednesday
    subDays(friday, 3),  // Tuesday
    monday,    // Monday
  ];
}

/**
 * Priority days for the week AFTER the weekend (closest to weekend first).
 * Order: Monday → Tuesday → Wednesday → Thursday → Friday.
 */
export function getAfterWeekendPriorityDays(sunday: Date): Date[] {
  const monday = addDays(sunday, 1);
  return [
    monday,    // 1st
    addDays(monday, 1),  // Tuesday
    addDays(monday, 2),  // Wednesday
    addDays(monday, 3),  // Thursday
    addDays(monday, 4),  // Friday
  ];
}

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function assignmentKey(memberId: string, dateKey: string): string {
  return `${memberId}|${dateKey}`;
}

/** Count how many employees have OFF on the given date. */
export function countOffEmployees(
  assignments: ScheduleAssignmentInput[],
  dateKey: string
): number {
  return assignments.filter(
    (a) => a.date === dateKey && a.status === "OFF"
  ).length;
}

/** Check if assigning OFF on dateKey would collide with another employee with same shift+level (already OFF that day). */
export function hasShiftLevelCollision(
  assignments: ScheduleAssignmentInput[],
  dateKey: string,
  shift: string,
  level: string,
  members: MemberForAllocation[],
  excludeMemberId?: string
): boolean {
  const memberIdsOffThatDay = new Set(
    assignments
      .filter((a) => a.date === dateKey && a.status === "OFF")
      .map((a) => a.memberId)
  );
  if (excludeMemberId) memberIdsOffThatDay.delete(excludeMemberId);
  for (const mid of memberIdsOffThatDay) {
    const m = members.find((x) => x.id === mid);
    if (m && m.shift === shift && m.level === level) return true;
  }
  return false;
}

/** Check if someone with the same level already has OFF on that date (same level cannot folgar on the same day). */
export function hasLevelCollision(
  assignments: ScheduleAssignmentInput[],
  dateKey: string,
  level: string,
  members: MemberForAllocation[],
  excludeMemberId?: string
): boolean {
  const memberIdsOffThatDay = new Set(
    assignments
      .filter((a) => a.date === dateKey && a.status === "OFF")
      .map((a) => a.memberId)
  );
  if (excludeMemberId) memberIdsOffThatDay.delete(excludeMemberId);
  for (const mid of memberIdsOffThatDay) {
    const m = members.find((x) => x.id === mid);
    if (m && m.level === level) return true;
  }
  return false;
}

/**
 * Check if we can assign OFF for this member on this date.
 * Valid when: OFF count < 5 AND no same-level collision (pessoas do mesmo nível não podem folgar no mesmo dia).
 */
export function canAssignOffDay(
  assignments: ScheduleAssignmentInput[],
  dateKey: string,
  member: MemberForAllocation,
  members: MemberForAllocation[],
  maxOffPerDay: number = MAX_OFF_PER_DAY
): boolean {
  const count = countOffEmployees(assignments, dateKey);
  const collision = hasLevelCollision(
    assignments,
    dateKey,
    member.level,
    members,
    member.id
  );
  return count < maxOffPerDay && !collision;
}

/**
 * Assign compensation OFF days for weekend workers: one OFF in the week before
 * and one in the week after each weekend. Uses strict priority order for
 * day placement. Does not override weekend WORK or existing OFF.
 */
export function assignCompensationDaysOff(
  weekendsWithWorkers: WeekendWithWorkers[],
  scheduleAssignments: ScheduleAssignmentInput[],
  members: MemberForAllocation[],
  month: number,
  year: number
): ScheduleAssignmentInput[] {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1 + 1, 0);

  const map = new Map<string, "WORK" | "OFF" | "SWAP_REQUESTED">();
  for (const a of scheduleAssignments) {
    map.set(assignmentKey(a.memberId, a.date), a.status);
  }

  const offCountByDate = new Map<string, number>();
  /** Per date: which levels already have someone OFF (same level cannot folgar on the same day). */
  const offLevelsByDate = new Map<string, Set<string>>();

  function currentStatus(memberId: string, dateKey: string): "WORK" | "OFF" | "SWAP_REQUESTED" | undefined {
    return map.get(assignmentKey(memberId, dateKey)) as "WORK" | "OFF" | "SWAP_REQUESTED" | undefined;
  }

  function setOff(memberId: string, dateKey: string, member: MemberForAllocation): void {
    map.set(assignmentKey(memberId, dateKey), "OFF");
    offCountByDate.set(dateKey, (offCountByDate.get(dateKey) ?? 0) + 1);
    const levels = offLevelsByDate.get(dateKey) ?? new Set<string>();
    levels.add(member.level);
    offLevelsByDate.set(dateKey, levels);
  }

  /** Current number of OFF on this date (includes OFF assigned during this run). */
  function countOffForDate(dateKey: string): number {
    if (offCountByDate.has(dateKey)) return offCountByDate.get(dateKey)!;
    const n = scheduleAssignments.filter((a) => a.date === dateKey && a.status === "OFF").length;
    offCountByDate.set(dateKey, n);
    const levels = new Set<string>();
    for (const a of scheduleAssignments.filter((a) => a.date === dateKey && a.status === "OFF")) {
      const m = members.find((x) => x.id === a.memberId);
      if (m) levels.add(m.level);
    }
    offLevelsByDate.set(dateKey, levels);
    return n;
  }

  /** True if someone with the same level already has OFF on this date (prioridade 1 ocupada → outro vai para prioridade 2). */
  function hasCollisionForDate(dateKey: string, member: MemberForAllocation): boolean {
    const levels = offLevelsByDate.get(dateKey);
    return levels?.has(member.level) ?? false;
  }

  /** Internal: can we assign OFF for this member on this date? (OFF count < 5, no same-level collision.) */
  function canAssignOff(member: MemberForAllocation, dateKey: string): boolean {
    if (currentStatus(member.id, dateKey) === "OFF") return false;
    const count = countOffForDate(dateKey);
    if (count >= MAX_OFF_PER_DAY) return false;
    if (hasCollisionForDate(dateKey, member)) return false;
    return true;
  }

  /** Try to assign one OFF in the week before the weekend using priority order. */
  function assignOffBeforeWeekend(member: MemberForAllocation, saturday: Date): void {
    const priorityDays = getBeforeWeekendPriorityDays(saturday);
    for (const day of priorityDays) {
      const dateKey = toDateKey(day);
      if (canAssignOff(member, dateKey)) {
        setOff(member.id, dateKey, member);
        return;
      }
    }
  }

  /** Try to assign one OFF in the week after the weekend using priority order. */
  function assignOffAfterWeekend(member: MemberForAllocation, sunday: Date): void {
    const priorityDays = getAfterWeekendPriorityDays(sunday);
    for (const day of priorityDays) {
      const dateKey = toDateKey(day);
      if (canAssignOff(member, dateKey)) {
        setOff(member.id, dateKey, member);
        return;
      }
    }
  }

  for (const { saturday, workerIds } of weekendsWithWorkers) {
    const sunday = addDays(saturday, 1);

    for (const memberId of workerIds) {
      const member = members.find((m) => m.id === memberId);
      if (!member) continue;

      assignOffBeforeWeekend(member, saturday);
      assignOffAfterWeekend(member, sunday);
    }
  }

  const result: ScheduleAssignmentInput[] = [];
  for (const [key, status] of map) {
    const idx = key.indexOf("|");
    if (idx === -1) continue;
    const memberId = key.slice(0, idx);
    const date = key.slice(idx + 1);
    const dateObj = new Date(date + "T12:00:00.000Z");
    if (dateObj >= monthStart && dateObj <= monthEnd) {
      result.push({ memberId, date, status });
    }
  }
  return result;
}

// --- Legacy export for backward compatibility with existing generator ---
import type { QueueMember } from "./queueManager";

export interface OffDayAssignment {
  memberId: string;
  dateKey: string;
}

/**
 * Assign one OFF in the week before and one OFF in the week after for each weekend worker.
 * Respects: max 5 OFF per weekday; same level cannot folgar on the same day.
 * @deprecated Prefer assignCompensationDaysOff which uses full assignment state.
 */
export function allocateCompensationOffDays(
  weekendWorkerIds: Set<string>,
  weekendSaturday: Date,
  weekendSunday: Date,
  members: QueueMember[]
): OffDayAssignment[] {
  const weekendsWithWorkers: WeekendWithWorkers[] = [
    { saturday: weekendSaturday, workerIds: weekendWorkerIds },
  ];
  const memberInput: MemberForAllocation[] = members.map((m) => ({
    id: m.id,
    shift: m.shift,
    level: m.level,
  }));
  const year = weekendSaturday.getFullYear();
  const month = weekendSaturday.getMonth() + 1;
  const emptyAssignments: ScheduleAssignmentInput[] = [];
  const result = assignCompensationDaysOff(
    weekendsWithWorkers,
    emptyAssignments,
    memberInput,
    month,
    year
  );
  return result
    .filter((a) => a.status === "OFF")
    .map((a) => ({ memberId: a.memberId, dateKey: a.date }));
}

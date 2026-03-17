import { addDays, subDays, format } from "date-fns";
import type { GroupKey } from "./queueManager";

const MAX_OFF_PER_DAY = 5;

/** Weekday for compensation: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri (date-fns getDay()). */
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;

export type CompensationPattern = { dayBefore: number; dayAfter: number };

/**
 * Gabarito de folgas de compensação por turno e nível (apenas N1/N2; sem ESPC/PRODUCAO).
 * Um dia na semana anterior ao fim de semana, um na posterior. Sem limite de pessoas nem colisão por nível.
 * Para grupos com 2 pessoas (ex.: T1_N2, T2_N2): array com 2 padrões — 1ª pessoa usa [0], 2ª usa [1].
 * dayBefore = dia da semana na semana do sábado (seg–sex); dayAfter = dia na semana após o domingo.
 */
export const COMPENSATION_GABARITO: Partial<Record<GroupKey, CompensationPattern | CompensationPattern[]>> = {
  T1_N1: { dayBefore: THU, dayAfter: WED },  // sex e seg
  T2_N1: { dayBefore: THU, dayAfter: WED },
  T3_N1: { dayBefore: THU, dayAfter: WED },   // quarta e terça
  T1_N2: [                                      // N2: uma sex+seg, outra qui+sext
    { dayBefore: WED, dayAfter: TUE },           // sex e seg
    { dayBefore: THU, dayAfter: WED },           // qui e sext
  ],
  T2_N2: [                                      // N2: uma sex+seg, outra qui+sext
    { dayBefore: WED, dayAfter: TUE },           // sex e seg
    { dayBefore: THU, dayAfter: WED },  
  ],
};

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

/**
 * Returns the two compensation dates for a weekend: one in the week before (weekday dayBefore),
 * one in the week after (weekday dayAfter). dayBefore/dayAfter: 1=Mon .. 5=Fri.
 */
function getCompensationDatesForWeekend(
  saturday: Date,
  sunday: Date,
  dayBefore: number,
  dayAfter: number
): { dateBefore: Date; dateAfter: Date } {
  // Week before: Monday = saturday - 5, so weekday w = subDays(saturday, 6 - w)
  const dateBefore = subDays(saturday, 6 - dayBefore);
  // Week after: weekday w = addDays(sunday, w)
  const dateAfter = addDays(sunday, dayAfter);
  return { dateBefore, dateAfter };
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
 * and one in the week after each weekend. Dias pré-definidos por nível e turno
 * (gabarito); sem regra de máximo de pessoas nem colisão por nível.
 */
export function assignCompensationDaysOff(
  weekendsWithWorkers: WeekendWithWorkers[],
  scheduleAssignments: ScheduleAssignmentInput[],
  members: MemberForAllocation[],
  month: number,
  year: number
): ScheduleAssignmentInput[] {
  const monthEnd = new Date(year, month - 1 + 1, 0);

  const map = new Map<string, "WORK" | "OFF" | "SWAP_REQUESTED">();
  for (const a of scheduleAssignments) {
    map.set(assignmentKey(a.memberId, a.date), a.status);
  }

  function setOff(memberId: string, dateKey: string): void {
    map.set(assignmentKey(memberId, dateKey), "OFF");
  }

  for (const { saturday, workerIds } of weekendsWithWorkers) {
    const sunday = addDays(saturday, 1);

    // Agrupa por turno+nível para N2: 1ª pessoa sex+seg, 2ª qui+sext (ordem estável por memberId)
    const byGroup = new Map<GroupKey, MemberForAllocation[]>();
    for (const memberId of workerIds) {
      const member = members.find((m) => m.id === memberId);
      if (!member) continue;
      const groupKey: GroupKey = `${member.shift}_${member.level}` as GroupKey;
      const gabarito = COMPENSATION_GABARITO[groupKey];
      if (!gabarito) continue;
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
      byGroup.get(groupKey)!.push(member);
    }

    for (const [groupKey, groupMembers] of byGroup) {
      const gabarito = COMPENSATION_GABARITO[groupKey]!;
      const patterns: CompensationPattern[] = Array.isArray(gabarito) ? gabarito : [gabarito];
      // Ordena por id para ordem estável: 1ª pessoa padrão [0], 2ª padrão [1], etc.
      const sorted = [...groupMembers].sort((a, b) => a.id.localeCompare(b.id));
      sorted.forEach((member, i) => {
        const pattern = patterns[i % patterns.length];
        const { dateBefore, dateAfter } = getCompensationDatesForWeekend(
          saturday,
          sunday,
          pattern.dayBefore,
          pattern.dayAfter
        );
        setOff(member.id, toDateKey(dateBefore));
        setOff(member.id, toDateKey(dateAfter));
      });
    }
  }

  const monthStart = new Date(year, month - 1, 1);
  // Include first week of next month so "week after" compensation for last weekend is kept
  const resultEnd = addDays(monthEnd, 7);
  const result: ScheduleAssignmentInput[] = [];
  for (const [key, status] of map) {
    const idx = key.indexOf("|");
    if (idx === -1) continue;
    const memberId = key.slice(0, idx);
    const date = key.slice(idx + 1);
    const dateObj = new Date(date + "T12:00:00.000Z");
    if (dateObj >= monthStart && dateObj <= resultEnd) {
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
 * Uses COMPENSATION_GABARITO (dias fixos por turno/nível); sem máximo por dia nem colisão por nível.
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

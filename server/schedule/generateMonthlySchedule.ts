import {
  startOfMonth,
  endOfMonth,
  getDay,
  addDays,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import type { QueueMember } from "./queueManager";
import { selectWeekendWorkers } from "./weekendSelector";
import {
  assignCompensationDaysOff,
  type ScheduleAssignmentInput,
  type WeekendWithWorkers,
  type MemberForAllocation,
} from "./offDayAllocator";

export interface ScheduleAssignmentOutput {
  memberId: string;
  date: string;
  status: "WORK" | "OFF" | "SWAP_REQUESTED";
}

const SATURDAY = 6;
const SUNDAY = 0;

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Get all Saturdays in the month (as Date objects). */
function getSaturdaysInMonth(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  const saturdays: Date[] = [];
  let d = new Date(start);
  while (d <= end) {
    if (getDay(d) === SATURDAY) {
      saturdays.push(new Date(d));
    }
    d = addDays(d, 1);
  }
  return saturdays;
}

/**
 * Generate the full set of assignments for the month.
 * - Weekends: selected workers WORK on Sat/Sun; everyone else OFF.
 * - Compensation: weekend workers get 1 OFF in week before and 1 OFF in week after.
 * - Weekdays: everyone WORK except assigned OFF (compensation).
 * - Queue positions are updated (weekend workers move to end).
 */
export async function generateMonthlySchedule(
  month: number,
  year: number
): Promise<ScheduleAssignmentOutput[]> {
  const allMembers = await prisma.teamMember.findMany({
    orderBy: [{ shift: "asc" }, { level: "asc" }, { name: "asc" }],
  });

  const rotationMembers = allMembers.filter((m) => m.level === "N1" || m.level === "N2");
  const alwaysOffWeekendMembers = allMembers.filter((m) => m.level === "ESPC" || m.level === "PRODUCAO");

  const queueMembers: QueueMember[] = rotationMembers.map((m) => ({
    id: m.id,
    name: m.name,
    shift: m.shift,
    level: m.level,
    rotationIndex: m.rotationIndex,
  }));

  const memberIds = new Set(allMembers.map((m) => m.id));
  const alwaysOffWeekendIds = new Set(alwaysOffWeekendMembers.map((m) => m.id));
  const assignmentsMap = new Map<string, "WORK" | "OFF">();
  const sep = "|";

  function setAssignment(memberId: string, dateKey: string, status: "WORK" | "OFF") {
    const key = `${memberId}${sep}${dateKey}`;
    if (!assignmentsMap.has(key)) {
      assignmentsMap.set(key, status);
    }
  }

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  let d = new Date(monthStart);
  while (d <= monthEnd) {
    const dateKey = toDateKey(d);
    const isSat = getDay(d) === SATURDAY;
    const isSun = getDay(d) === SUNDAY;
    if (!isSat && !isSun) {
      for (const mid of memberIds) {
        setAssignment(mid, dateKey, "WORK");
      }
    }
    d = addDays(d, 1);
  }

  const saturdays = getSaturdaysInMonth(year, month);
  const finalQueueUpdates = new Map<string, number>();
  const weekendsWithWorkers: WeekendWithWorkers[] = [];

  for (const saturday of saturdays) {
    const sunday = addDays(saturday, 1);
    const { weekendWorkerIds, queueUpdates } = selectWeekendWorkers(
      queueMembers,
      saturday,
      sunday
    );

    for (const u of queueUpdates) {
      finalQueueUpdates.set(u.memberId, u.newRotationIndex);
      const m = queueMembers.find((x) => x.id === u.memberId);
      if (m) m.rotationIndex = u.newRotationIndex;
    }

    const satKey = toDateKey(saturday);
    const sunKey = toDateKey(sunday);

    for (const mid of memberIds) {
      if (alwaysOffWeekendIds.has(mid)) {
        setAssignment(mid, satKey, "OFF");
        setAssignment(mid, sunKey, "OFF");
      } else if (weekendWorkerIds.has(mid)) {
        setAssignment(mid, satKey, "WORK");
        setAssignment(mid, sunKey, "WORK");
      } else {
        setAssignment(mid, satKey, "OFF");
        setAssignment(mid, sunKey, "OFF");
      }
    }

    weekendsWithWorkers.push({ saturday, workerIds: weekendWorkerIds });
  }

  const membersForAllocation: MemberForAllocation[] = rotationMembers.map((m) => ({
    id: m.id,
    shift: m.shift,
    level: m.level,
  }));

  const assignmentsArray: ScheduleAssignmentInput[] = [];
  for (const [key, status] of assignmentsMap) {
    const idx = key.indexOf(sep);
    if (idx === -1) continue;
    const memberId = key.slice(0, idx);
    const date = key.slice(idx + 1);
    const dateInMonth = new Date(date + "T12:00:00.000Z");
    if (dateInMonth >= monthStart && dateInMonth <= monthEnd) {
      assignmentsArray.push({ memberId, date, status });
    }
  }

  const withCompensation = assignCompensationDaysOff(
    weekendsWithWorkers,
    assignmentsArray,
    membersForAllocation,
    month,
    year
  );

  for (const [memberId, newRotationIndex] of finalQueueUpdates) {
    await prisma.teamMember.update({
      where: { id: memberId },
      data: { rotationIndex: newRotationIndex },
    });
  }

  const result: ScheduleAssignmentOutput[] = withCompensation.map((a) => ({
    memberId: a.memberId,
    date: a.date,
    status: a.status,
  }));
  return result;
}

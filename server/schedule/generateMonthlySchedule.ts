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
import {
  getWeekendCoverageCount,
  resolveScheduleRules,
  type ResolvedRuleSet,
} from "./resolveScheduleRules";

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
 * Gera todas as atribuições do mês para uma equipe:
 * - Dias úteis: todos WORK, exceto OFF de compensação.
 * - Fim de semana: trabalhadores escolhidos da fila (`WEEKEND_COVERAGE`),
 *   demais OFF.
 * - Compensação: trabalhadores do FDS ganham um OFF na semana anterior e um
 *   na semana posterior, conforme o padrão configurado em `COMPENSATION_PATTERN`.
 *
 * As regras são lidas de `schedule_rules` via `resolveScheduleRules`. Se um
 * grupo (shift × level) não tiver regra de cobertura ou tiver `count=0`,
 * todos desse grupo folgam no FDS.
 *
 * O parâmetro opcional `teamId` fixa de qual equipe carregar as regras. Se
 * ausente, o teamId é derivado dos membros (caminho legado usado quando o
 * schedule é global).
 */
export interface GenerateMonthlyScheduleOptions {
  /**
   * Quando `true`, não persiste atualizações no `rotationIndex`. Use para
   * simulações/pré-visualizações sem efeito colateral no banco.
   */
  dryRun?: boolean;
}

export async function generateMonthlySchedule(
  month: number,
  year: number,
  teamId?: string,
  options?: GenerateMonthlyScheduleOptions
): Promise<ScheduleAssignmentOutput[]> {
  const dryRun = options?.dryRun === true;
  const allMembers = await prisma.teamMember.findMany({
    where: {
      participatesInSchedule: true,
      ...(teamId ? { teamId } : {}),
    },
    select: {
      id: true,
      name: true,
      teamId: true,
      teamShiftId: true,
      teamLevelId: true,
      rotationIndex: true,
    },
    orderBy: [{ teamShiftId: "asc" }, { teamLevelId: "asc" }, { name: "asc" }],
  });

  const scheduleTeamId = teamId ?? allMembers[0]?.teamId ?? null;
  const resolved: ResolvedRuleSet = scheduleTeamId
    ? await resolveScheduleRules(scheduleTeamId)
    : { teamId: "", weekendCoverage: new Map(), compensationPattern: new Map() };

  const queueMembers: QueueMember[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    teamShiftId: m.teamShiftId,
    teamLevelId: m.teamLevelId,
    rotationIndex: m.rotationIndex,
  }));

  // Split entre quem entra no rodízio de FDS (count > 0) e quem sempre folga.
  const rotationMembers = queueMembers.filter(
    (m) => getWeekendCoverageCount(resolved, m.teamShiftId, m.teamLevelId) > 0
  );
  const alwaysOffWeekendIds = new Set(
    queueMembers
      .filter((m) => getWeekendCoverageCount(resolved, m.teamShiftId, m.teamLevelId) <= 0)
      .map((m) => m.id)
  );

  const memberIds = new Set(allMembers.map((m) => m.id));
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

  const finalQueueUpdates = new Map<string, number>();
  const weekendsWithWorkers: WeekendWithWorkers[] = [];

  // Quando o 1º dia do mês é domingo, ele pertence ao último FDS do mês anterior.
  // Copia do mês anterior se já existir, senão calcula diretamente.
  const firstDayOfMonth = new Date(year, month - 1, 1);
  if (getDay(firstDayOfMonth) === SUNDAY) {
    const firstDayKey = toDateKey(firstDayOfMonth);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSchedule = scheduleTeamId
      ? await prisma.schedule.findUnique({
          where: { teamId_year_month: { teamId: scheduleTeamId, year: prevYear, month: prevMonth } },
          include: { assignments: true },
        })
      : await prisma.schedule.findFirst({
          where: { year: prevYear, month: prevMonth },
          include: { assignments: true },
        });
    const firstDayAssignments = prevSchedule?.assignments.filter(
      (a) => format(a.date, "yyyy-MM-dd") === firstDayKey
    ) ?? [];
    const offOnFirstDay = new Set(
      firstDayAssignments.filter((a) => a.status === "OFF").map((a) => a.memberId)
    );
    if (firstDayAssignments.length > 0) {
      for (const mid of memberIds) {
        setAssignment(mid, firstDayKey, offOnFirstDay.has(mid) ? "OFF" : "WORK");
      }
    } else {
      const lastDayOfPrevMonth = endOfMonth(new Date(prevYear, prevMonth - 1));
      const saturday = lastDayOfPrevMonth;
      const sunday = firstDayOfMonth;
      const { weekendWorkerIds, queueUpdates } = selectWeekendWorkers(
        rotationMembers,
        saturday,
        sunday,
        resolved
      );
      for (const u of queueUpdates) {
        finalQueueUpdates.set(u.memberId, u.newRotationIndex);
        const m = rotationMembers.find((x) => x.id === u.memberId);
        if (m) m.rotationIndex = u.newRotationIndex;
      }
      for (const mid of memberIds) {
        if (alwaysOffWeekendIds.has(mid)) {
          setAssignment(mid, firstDayKey, "OFF");
        } else if (weekendWorkerIds.has(mid)) {
          setAssignment(mid, firstDayKey, "WORK");
        } else {
          setAssignment(mid, firstDayKey, "OFF");
        }
      }
      weekendsWithWorkers.push({ saturday, workerIds: weekendWorkerIds });
    }
  }

  const saturdays = getSaturdaysInMonth(year, month);

  for (const saturday of saturdays) {
    const sunday = addDays(saturday, 1);
    const { weekendWorkerIds, queueUpdates } = selectWeekendWorkers(
      rotationMembers,
      saturday,
      sunday,
      resolved
    );

    for (const u of queueUpdates) {
      finalQueueUpdates.set(u.memberId, u.newRotationIndex);
      const m = rotationMembers.find((x) => x.id === u.memberId);
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
    teamShiftId: m.teamShiftId,
    teamLevelId: m.teamLevelId,
  }));

  const nextMonthFirstKey = format(addDays(monthEnd, 1), "yyyy-MM-dd");
  const assignmentsArray: ScheduleAssignmentInput[] = [];
  for (const [key, status] of assignmentsMap) {
    const idx = key.indexOf(sep);
    if (idx === -1) continue;
    const memberId = key.slice(0, idx);
    const date = key.slice(idx + 1);
    const dateInMonth = new Date(date + "T12:00:00.000Z");
    const inCurrentMonth = dateInMonth >= monthStart && dateInMonth <= monthEnd;
    const isStraddlingSunday = date === nextMonthFirstKey;
    if (inCurrentMonth || isStraddlingSunday) {
      assignmentsArray.push({ memberId, date, status });
    }
  }

  const withCompensation = assignCompensationDaysOff(
    weekendsWithWorkers,
    assignmentsArray,
    membersForAllocation,
    month,
    year,
    resolved
  );

  if (!dryRun) {
    for (const [memberId, newRotationIndex] of finalQueueUpdates) {
      await prisma.teamMember.update({
        where: { id: memberId },
        data: { rotationIndex: newRotationIndex },
      });
    }
  }

  const result: ScheduleAssignmentOutput[] = withCompensation.map((a) => ({
    memberId: a.memberId,
    date: a.date,
    status: a.status,
  }));
  return result;
}

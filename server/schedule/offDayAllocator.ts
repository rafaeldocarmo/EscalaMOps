import { addDays, subDays, format } from "date-fns";
import {
  getCompensationPatterns,
  type ResolvedRuleSet,
} from "./resolveScheduleRules";

/** Assignment shape used for allocation (date as YYYY-MM-DD). */
export interface ScheduleAssignmentInput {
  memberId: string;
  date: string;
  status: "WORK" | "OFF" | "SWAP_REQUESTED";
}

/** Minimal member shape with the catalog IDs used to look up rules. */
export interface MemberForAllocation {
  id: string;
  teamShiftId: string;
  teamLevelId: string;
}

/** One weekend and the set of member IDs who work it. */
export interface WeekendWithWorkers {
  saturday: Date;
  workerIds: Set<string>;
}

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function assignmentKey(memberId: string, dateKey: string): string {
  return `${memberId}|${dateKey}`;
}

/**
 * Para um fim de semana, calcula as datas de compensação:
 * - `dateBefore`: dia X da semana anterior ao sábado (1=seg .. 5=sex);
 * - `dateAfter`: dia X da semana seguinte ao domingo.
 */
function getCompensationDatesForWeekend(
  saturday: Date,
  sunday: Date,
  dayBefore: number,
  dayAfter: number
): { dateBefore: Date; dateAfter: Date } {
  const dateBefore = subDays(saturday, 6 - dayBefore);
  const dateAfter = addDays(sunday, dayAfter);
  return { dateBefore, dateAfter };
}

/**
 * Atribui as folgas de compensação para quem trabalhou no fim de semana:
 * um OFF na semana anterior e outro na posterior, baseado no padrão configurado
 * em `ResolvedRuleSet.compensationPattern` para o grupo (shift × level) do
 * membro. Grupos sem padrão configurado não ganham compensação automática.
 */
export function assignCompensationDaysOff(
  weekendsWithWorkers: WeekendWithWorkers[],
  scheduleAssignments: ScheduleAssignmentInput[],
  members: MemberForAllocation[],
  month: number,
  year: number,
  resolved: ResolvedRuleSet
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

    // Agrupa workers por (shiftId, levelId) para que a 1ª pessoa do grupo
    // use patterns[0], a 2ª patterns[1], etc. (ordem estável por id).
    const byGroup = new Map<string, MemberForAllocation[]>();
    for (const memberId of workerIds) {
      const member = members.find((m) => m.id === memberId);
      if (!member) continue;
      const key = `${member.teamShiftId}|${member.teamLevelId}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(member);
    }

    for (const [, groupMembers] of byGroup) {
      const first = groupMembers[0];
      const patterns = getCompensationPatterns(
        resolved,
        first.teamShiftId,
        first.teamLevelId
      );
      if (patterns.length === 0) continue;

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
  // Inclui a 1ª semana do próximo mês para preservar a compensação pós-FDS
  // do último fim de semana.
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

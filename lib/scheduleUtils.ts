import type { ScheduleAssignmentRow, ScheduleStateMap, AssignmentStatus } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  addDays,
  isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/** Capitalize first letter for PT-BR weekday abbreviation (Seg, Ter, Sáb, etc.). */
function ptBrWeekdayAbbr(date: Date): string {
  const s = format(date, "EEE", { locale: ptBR }).slice(0, 3);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const WEEK_STARTS_ON = 1; // Monday

export interface ScheduleCalendarDay {
  dateKey: string;
  dayLabel: string;
  weekdayLabel: string;
  isCurrentMonth: boolean;
}

/** Calendar view: all days from first Monday to last Sunday covering the month. */
export function getScheduleCalendarDays(
  year: number,
  month: number
): ScheduleCalendarDay[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const weekStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const days: ScheduleCalendarDay[] = [];
  let d = new Date(weekStart);
  while (d <= weekEnd) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dateKey = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({
      dateKey,
      dayLabel: String(day).padStart(2, "0"),
      weekdayLabel: ptBrWeekdayAbbr(d),
      isCurrentMonth: isSameMonth(d, monthStart),
    });
    d = addDays(d, 1);
  }
  return days;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Build state map from assignments list. */
export function assignmentsToStateMap(
  assignments: ScheduleAssignmentRow[]
): ScheduleStateMap {
  const map: ScheduleStateMap = {};
  for (const a of assignments) {
    if (!map[a.memberId]) map[a.memberId] = {};
    map[a.memberId][a.date] = a.status;
  }
  return map;
}

/** Date key for a day of the month (YYYY-MM-DD). */
export function dateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

interface GroupedMember {
  member: TeamMemberRow;
  shift: string;
  level: string;
}

/** Group members by level, then by shift, then by queue position (`rotationIndex`). Returns flat list with shift/level labels for rendering. */
export function groupMembersByShiftAndLevel(
  members: TeamMemberRow[]
): GroupedMember[] {
  const sorted = [...members].sort((a, b) => {
    const levelCmp = a.levelLabel.localeCompare(b.levelLabel, "pt-BR");
    if (levelCmp !== 0) return levelCmp;
    const shiftCmp = a.shiftLabel.localeCompare(b.shiftLabel, "pt-BR");
    if (shiftCmp !== 0) return shiftCmp;
    const rot = a.rotationIndex - b.rotationIndex;
    if (rot !== 0) return rot;
    return a.name.localeCompare(b.name, "pt-BR");
  });
  return sorted.map((member) => ({
    member,
    shift: member.shiftLabel,
    level: member.levelLabel,
  }));
}

export interface ScheduleSection {
  shift: string;
  level: string;
  members: TeamMemberRow[];
}

/** Build sections for grid: shift + level groups with member lists. */
export function buildScheduleSections(
  members: TeamMemberRow[]
): ScheduleSection[] {
  const grouped = groupMembersByShiftAndLevel(members);
  const sections: ScheduleSection[] = [];
  let current: ScheduleSection | null = null;
  for (const { member, shift, level } of grouped) {
    if (
      !current ||
      current.shift !== shift ||
      current.level !== level
    ) {
      current = { shift, level, members: [] };
      sections.push(current);
    }
    current.members.push(member);
  }
  return sections;
}

function isWeekendDateKeyUTC(dateKey: string): boolean {
  // Use UTC-safe anchor to avoid timezone shifts.
  const d = new Date(dateKey + "T12:00:00.000Z");
  const wd = d.getUTCDay(); // 0=Sun, 6=Sat
  return wd === 0 || wd === 6;
}

/** Alinhado à célula da grade: só `OFF` é folga; ausência de chave = trabalho (default). */
function cellShowsWorkOnSchedule(status: AssignmentStatus | undefined): boolean {
  return status !== "OFF";
}

function weekendGroupKeyUTC(dateKey: string): string {
  // Use the Saturday of that weekend as the stable key (YYYY-MM-DD).
  const d = new Date(dateKey + "T12:00:00.000Z");
  const wd = d.getUTCDay(); // 0=Sun, 6=Sat
  if (wd === 6) return dateKey; // Saturday
  if (wd === 0) {
    const prev = new Date(d.getTime() - 86400000);
    const y = prev.getUTCFullYear();
    const m = String(prev.getUTCMonth() + 1).padStart(2, "0");
    const day = String(prev.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // Not weekend: fall back to same day (shouldn't happen for our callers).
  return dateKey;
}

/**
 * Ordenação visual da grade (por nível/turno):
 * - Só considera fins de semana que caem no **mês exibido** (`isCurrentMonth`), evitando colunas
 *   de “echimento” do mês anterior/seguinte ao mudar de mês.
 * - Primeiro: quem **trabalha** no 1º desses fins de semana (default de célula = trabalho, como na UI).
 * - Depois: 2º fim de semana, etc. (chave = sábado da semana em UTC).
 * - Quem está `OFF` em todos os fds do mês fica por último; desempate: `rotationIndex`, nome.
 */
export function buildScheduleSectionsByNextWeekend(
  members: TeamMemberRow[],
  stateMap: ScheduleStateMap,
  year: number,
  month: number
): ScheduleSection[] {
  const calendarDays = getScheduleCalendarDays(year, month);
  const weekendDateKeys = calendarDays
    .filter((d) => d.isCurrentMonth && isWeekendDateKeyUTC(d.dateKey))
    .map((d) => d.dateKey);

  const nextWeekendGroupKeyByMemberId = new Map<string, string>();
  for (const m of members) {
    const slice = stateMap[m.id] ?? {};
    let nextGroupKey: string | null = null;
    for (const dk of weekendDateKeys) {
      if (!cellShowsWorkOnSchedule(slice[dk])) continue;
      const gk = weekendGroupKeyUTC(dk);
      if (!nextGroupKey || gk.localeCompare(nextGroupKey) < 0) {
        nextGroupKey = gk;
      }
    }
    if (nextGroupKey) nextWeekendGroupKeyByMemberId.set(m.id, nextGroupKey);
  }

  const sorted = [...members].sort((a, b) => {
    const levelCmp = a.levelLabel.localeCompare(b.levelLabel, "pt-BR");
    if (levelCmp !== 0) return levelCmp;
    const shiftCmp = a.shiftLabel.localeCompare(b.shiftLabel, "pt-BR");
    if (shiftCmp !== 0) return shiftCmp;

    const na = nextWeekendGroupKeyByMemberId.get(a.id);
    const nb = nextWeekendGroupKeyByMemberId.get(b.id);
    if (na && nb) {
      if (na !== nb) return na.localeCompare(nb);
    } else if (na && !nb) {
      return -1;
    } else if (!na && nb) {
      return 1;
    }

    const rot = a.rotationIndex - b.rotationIndex;
    if (rot !== 0) return rot;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const grouped = sorted.map((member) => ({
    member,
    shift: member.shiftLabel,
    level: member.levelLabel,
  }));

  const sections: ScheduleSection[] = [];
  let current: ScheduleSection | null = null;
  for (const { member, shift, level } of grouped) {
    if (!current || current.shift !== shift || current.level !== level) {
      current = { shift, level, members: [] };
      sections.push(current);
    }
    current.members.push(member);
  }
  return sections;
}

export function periodsToDateSet(periods: { startDate: string; endDate: string }[]): Set<string> {
  const set = new Set<string>();
  for (const p of periods) {
    const start = new Date(p.startDate + "T12:00:00.000Z");
    const end = new Date(p.endDate + "T12:00:00.000Z");
    let d = new Date(start);
    while (d < end) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      set.add(`${y}-${m}-${day}`);
      d = new Date(d.getTime() + 86400000);
    }
  }
  return set;
}

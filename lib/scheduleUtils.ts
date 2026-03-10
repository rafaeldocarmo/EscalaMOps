import type { ScheduleAssignmentRow, ScheduleStateMap } from "@/types/schedule";
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

export interface GroupedMember {
  member: TeamMemberRow;
  shift: string;
  level: string;
}

/** Group members by level, then by shift, then by name. Returns flat list with shift/level labels for rendering. */
export function groupMembersByShiftAndLevel(
  members: TeamMemberRow[]
): GroupedMember[] {
  const sorted = [...members].sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
    return a.name.localeCompare(b.name, "pt-BR");
  });
  return sorted.map((member) => ({
    member,
    shift: member.shift,
    level: member.level,
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

/** Get status for a cell from state map, default WORK. */
export function getCellStatus(
  map: ScheduleStateMap,
  memberId: string,
  dateKey: string
): "WORK" | "OFF" | "SWAP_REQUESTED" {
  return map[memberId]?.[dateKey] ?? "WORK";
}

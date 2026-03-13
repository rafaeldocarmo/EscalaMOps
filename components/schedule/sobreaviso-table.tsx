"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { STICKY_CELL_BASE, STICKY_COLUMN_WIDTH } from "./schedule-header";
import { ScheduleHeader } from "./schedule-header";
import { formatMemberName } from "@/lib/formatMemberName";
import type { ScheduleCalendarDay } from "@/lib/scheduleUtils";
import type { SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

interface SobreavisoTableProps {
  weeks: SobreavisoWeek[];
  calendarDays: ScheduleCalendarDay[];
  onMemberClick?: (memberId: string) => void;
  selectedMemberId?: string | null;
}

interface SobreavisoMember {
  memberId: string;
  memberName: string;
  level: string;
  activeDates: Set<string>;
  transitionDates: Set<string>;
}

function toUtcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildSobreavisoMembers(weeks: SobreavisoWeek[]): SobreavisoMember[] {
  const map = new Map<string, SobreavisoMember>();

  for (const w of weeks) {
    const key = w.memberId;
    if (!map.has(key)) {
      map.set(key, {
        memberId: w.memberId,
        memberName: w.memberName,
        level: w.level,
        activeDates: new Set(),
        transitionDates: new Set(),
      });
    }
    const member = map.get(key)!;

    const start = new Date(w.startDate + "T12:00:00.000Z");
    const end = new Date(w.endDate + "T12:00:00.000Z");

    let d = new Date(start);
    while (d < end) {
      member.activeDates.add(toUtcDateKey(d));
      d = new Date(d.getTime() + 86400000);
    }

    member.transitionDates.add(toUtcDateKey(end));
  }

  for (const member of map.values()) {
    for (const dt of member.transitionDates) {
      member.activeDates.delete(dt);
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    return a.memberName.localeCompare(b.memberName, "pt-BR");
  });
  return result;
}

function groupByLevel(members: SobreavisoMember[]): { level: string; members: SobreavisoMember[] }[] {
  const groups: { level: string; members: SobreavisoMember[] }[] = [];
  let current: { level: string; members: SobreavisoMember[] } | null = null;
  for (const m of members) {
    if (!current || current.level !== m.level) {
      current = { level: m.level, members: [] };
      groups.push(current);
    }
    current.members.push(m);
  }
  return groups;
}

export function SobreavisoTable({ weeks, calendarDays, onMemberClick, selectedMemberId }: SobreavisoTableProps) {
  const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
  const sobreavisoMembers = buildSobreavisoMembers(weeks);
  const sections = groupByLevel(sobreavisoMembers);

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">Sobreaviso</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-xs">
          <ScheduleHeader calendarDays={currentMonthDays} />
          <tbody>
            {sections.length === 0 ? (
              <tr>
                <td
                  colSpan={currentMonthDays.length + 1}
                  className="h-24 px-4 text-center text-muted-foreground"
                >
                  Nenhum sobreaviso gerado para este mês.
                </td>
              </tr>
            ) : (
              sections.map((section) => (
                <Fragment key={section.level}>
                  <tr className="border-b border-border bg-muted/20">
                    <td
                      className={`${STICKY_CELL_BASE} min-h-[2rem] px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${STICKY_COLUMN_WIDTH}`}
                    >
                      {section.level}
                    </td>
                    <td
                      colSpan={currentMonthDays.length}
                      className="border-b border-border bg-muted/20 p-0"
                    />
                  </tr>
                  {section.members.map((member) => (
                    <tr
                      key={member.memberId}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td
                        className={`${STICKY_CELL_BASE} h-8 px-2 py-1 font-medium text-xs align-middle ${STICKY_COLUMN_WIDTH}`}
                      >
                        <span
                          className={`block whitespace-nowrap overflow-hidden text-ellipsis rounded px-1 py-0.5 transition-colors ${
                            onMemberClick ? "cursor-pointer hover:bg-blue-100" : ""
                          } ${selectedMemberId === member.memberId ? "bg-blue-500 text-white" : ""}`}
                          title={member.memberName}
                          onClick={onMemberClick ? () => onMemberClick(member.memberId) : undefined}
                        >
                          {formatMemberName(member.memberName)}
                        </span>
                      </td>
                      {currentMonthDays.map((day) => {
                        const isActive = member.activeDates.has(day.dateKey);
                        const isTransition = member.transitionDates.has(day.dateKey);
                        return (
                          <td
                            key={day.dateKey}
                            className={cn(
                              "h-8 min-w-[2.25rem] border-b border-r border-border p-0 text-xs last:border-r-0",
                              isActive
                                ? "bg-blue-500"
                                : isTransition
                                  ? "bg-blue-200"
                                  : "bg-background"
                            )}
                            aria-label={`${day.dateKey}: ${isActive ? "SOBREAVISO" : isTransition ? "TRANSIÇÃO" : ""}`}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

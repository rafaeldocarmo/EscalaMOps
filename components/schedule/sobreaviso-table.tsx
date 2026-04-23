"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { STICKY_CELL_BASE, STICKY_COLUMN_WIDTH } from "./schedule-header";
import { ScheduleHeader } from "./schedule-header";
import { formatMemberName } from "@/lib/formatMemberName";
import type { ScheduleCalendarDay } from "@/lib/scheduleUtils";
import type { SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

export interface SobreavisoEligibleMember {
  id: string;
  name: string;
  level: string;
}

interface SobreavisoTableProps {
  weeks: SobreavisoWeek[];
  calendarDays: ScheduleCalendarDay[];
  /** Participantes do sobreaviso (sobreaviso=true, nível N2/ESPC/PRODUCAO). Todos aparecem na tabela. */
  eligibleMembers?: SobreavisoEligibleMember[];
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


function buildSobreavisoMembers(
  weeks: SobreavisoWeek[],
  eligibleMembers?: SobreavisoEligibleMember[]
): SobreavisoMember[] {
  const map = new Map<string, SobreavisoMember>();

  // Inclui todos os participantes elegíveis (para ninguém “sumir” da escala).
  if (eligibleMembers?.length) {
    for (const m of eligibleMembers) {
      map.set(m.id, {
        memberId: m.id,
        memberName: m.name,
        level: m.level,
        activeDates: new Set(),
        transitionDates: new Set(),
      });
    }
  }

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

export function SobreavisoTable({
  weeks,
  calendarDays,
  eligibleMembers,
  onMemberClick,
  selectedMemberId,
}: SobreavisoTableProps) {
  const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
  const sobreavisoMembers = buildSobreavisoMembers(weeks, eligibleMembers);
  const sections = groupByLevel(sobreavisoMembers);
  const hasEligible = eligibleMembers && eligibleMembers.length > 0;

  return (
    <div className="space-y-2">
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
                  {hasEligible
                    ? "Nenhum sobreaviso gerado para este mês."
                    : "Nenhum participante de sobreaviso na equipe."}
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
                        const hoverLabel = `${day.weekdayLabel}, ${day.dayLabel}/${day.dateKey.slice(5, 7)}/${day.dateKey.slice(0, 4)}`;
                        return (
                          <td
                            key={day.dateKey}
                            className={cn(
                              "group relative h-8 min-w-[2.25rem] border-b border-r border-border p-0 text-xs last:border-r-0",
                              isActive
                                ? "bg-blue-500"
                                : isTransition
                                  ? "bg-blue-200"
                                  : "bg-background"
                            )}
                            aria-label={`${day.dateKey}: ${isActive ? "SOBREAVISO" : isTransition ? "TRANSIÇÃO" : ""}`}
                          >
                            <span
                              className={cn(
                                "pointer-events-none absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-[calc(100%+8px)]",
                                "whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-900 shadow-sm",
                                "dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-100",
                                "opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                              )}
                            >
                              {hoverLabel}
                            </span>
                          </td>
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

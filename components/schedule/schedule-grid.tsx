"use client";

import { Fragment } from "react";
import { ScheduleHeader, STICKY_COLUMN_WIDTH, STICKY_CELL_BASE } from "./schedule-header";
import { ScheduleRow } from "./schedule-row";
import type { ScheduleStateMap } from "@/types/schedule";
import type { ScheduleSection, ScheduleCalendarDay } from "@/lib/scheduleUtils";

interface ScheduleGridProps {
  sections: ScheduleSection[];
  calendarDays: ScheduleCalendarDay[];
  stateMap: ScheduleStateMap;
  shiftSwapPurpleByMemberId?: Record<string, string[]>;
  onCellToggle: (memberId: string, dateKey: string) => void;
  onMemberClick?: (memberId: string) => void;
  selectedMemberId?: string | null;
  locked: boolean;
}

export function ScheduleGrid({
  sections,
  calendarDays,
  stateMap,
  shiftSwapPurpleByMemberId,
  onCellToggle,
  onMemberClick,
  selectedMemberId,
  locked,
}: ScheduleGridProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-xs">
        <ScheduleHeader calendarDays={calendarDays} />
        <tbody>
          {sections.map((section) => (
            <Fragment key={`${section.shift}-${section.level}`}>
              <tr className="border-b border-border bg-muted/20">
                <td
                  className={`${STICKY_CELL_BASE} min-h-[2rem] px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${STICKY_COLUMN_WIDTH}`}
                >
                  <div className="flex flex-col">
                    <span>{section.level} - {section.shift}</span>
                  </div>
                </td>
                <td
                  colSpan={calendarDays.length}
                  className="border-b border-border bg-muted/20 p-0"
                />
              </tr>
              {section.members.map((member) => (
                <ScheduleRow
                  key={member.id}
                  member={member}
                  calendarDays={calendarDays}
                  stateSlice={stateMap[member.id] ?? {}}
                  shiftSwapPurpleDateKeys={shiftSwapPurpleByMemberId?.[member.id]}
                  locked={locked}
                  onCellToggle={onCellToggle}
                  onMemberClick={onMemberClick}
                  isSelected={selectedMemberId === member.id}
                  stickyColumnWidth={STICKY_COLUMN_WIDTH}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

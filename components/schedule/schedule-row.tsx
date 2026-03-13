"use client";

import { memo } from "react";
import { ScheduleCell } from "./schedule-cell";
import type { TeamMemberRow } from "@/types/team";
import type { AssignmentStatus } from "@/types/schedule";
import type { ScheduleCalendarDay } from "@/lib/scheduleUtils";
import { formatMemberName } from "@/lib/formatMemberName";
import { STICKY_CELL_BASE } from "./schedule-header";

interface ScheduleRowProps {
  member: TeamMemberRow;
  calendarDays: ScheduleCalendarDay[];
  stateSlice: Record<string, AssignmentStatus>;
  locked: boolean;
  onCellToggle: (memberId: string, dateKey: string) => void;
  onMemberClick?: (memberId: string) => void;
  isSelected?: boolean;
  stickyColumnWidth: string;
}

function ScheduleRowComponent({
  member,
  calendarDays,
  stateSlice,
  locked,
  onCellToggle,
  onMemberClick,
  isSelected,
  stickyColumnWidth,
}: ScheduleRowProps) {
  const handleToggle = (dateKey: string) => onCellToggle(member.id, dateKey);

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td
        className={`${STICKY_CELL_BASE} h-8 px-2 py-1 font-medium text-xs align-middle ${stickyColumnWidth}`}
      >
        <span
          className={`block whitespace-nowrap overflow-hidden text-ellipsis rounded px-1 py-0.5 transition-colors ${
            onMemberClick ? "cursor-pointer hover:bg-blue-100" : ""
          } ${isSelected ? "bg-blue-500 text-white" : ""}`}
          title={member.name}
          onClick={onMemberClick ? () => onMemberClick(member.id) : undefined}
        >
          {formatMemberName(member.name)}
        </span>
      </td>
      {calendarDays.map((day) => (
        <ScheduleCell
          key={day.dateKey}
          dateKey={day.dateKey}
          status={stateSlice[day.dateKey] ?? "WORK"}
          locked={locked}
          isCurrentMonth={day.isCurrentMonth}
          onToggle={handleToggle}
        />
      ))}
    </tr>
  );
}

export const ScheduleRow = memo(ScheduleRowComponent);

"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { AssignmentStatus } from "@/types/schedule";

const statusStyles: Record<AssignmentStatus, string> = {
  WORK: "bg-green-500 hover:bg-green-600",
  OFF: "bg-red-500 hover:bg-red-600",
  SWAP_REQUESTED: "bg-yellow-400 hover:bg-yellow-500 cursor-default",
};

interface ScheduleCellProps {
  dateKey: string;
  status: AssignmentStatus;
  locked: boolean;
  isCurrentMonth: boolean;
  shiftSwapPurple?: boolean;
  hoursWithdrawnOrange?: boolean;
  onToggle: (dateKey: string) => void;
}

function ScheduleCellComponent({
  dateKey,
  status,
  locked,
  isCurrentMonth,
  shiftSwapPurple,
  hoursWithdrawnOrange,
  onToggle,
}: ScheduleCellProps) {
  const isClickable =
    isCurrentMonth && !locked && status !== "SWAP_REQUESTED";
  const handleClick = () => {
    if (isClickable) onToggle(dateKey);
  };

  return (
    <td
      className={cn(
        "h-8 min-w-[2.25rem] border-b border-r border-border p-0 text-xs transition-colors last:border-r-0",
        statusStyles[status],
        shiftSwapPurple && isCurrentMonth ? "bg-purple-900/75" : "",
        // Retirada de horas (banco de horas): destaque laranja apenas quando o dia ainda é WORK.
        hoursWithdrawnOrange && isCurrentMonth && status === "WORK" && !shiftSwapPurple
          ? "bg-orange-500/90"
          : "",
        isClickable && "cursor-pointer",
        !isClickable && "cursor-default",
        !isCurrentMonth && "opacity-40 pointer-events-none"
      )}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggle(dateKey);
        }
      }}
      aria-label={`${dateKey}: ${status}`}
    />
  );
}

export const ScheduleCell = memo(ScheduleCellComponent);

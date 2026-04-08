"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { AssignmentStatus } from "@/types/schedule";

const statusStyles: Record<AssignmentStatus, string> = {
  WORK: "bg-emerald-300 hover:bg-emerald-400 dark:bg-emerald-600/75 dark:hover:bg-emerald-500/85",
  OFF: "bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/60 dark:hover:bg-rose-400/70",
  SWAP_REQUESTED: "bg-amber-300 hover:bg-amber-400 dark:bg-amber-500/80 dark:hover:bg-amber-400/90 cursor-default",
};

interface ScheduleCellProps {
  dateKey: string;
  status: AssignmentStatus;
  locked: boolean;
  isCurrentMonth: boolean;
  hoverLabel?: string;
  shiftSwapPurple?: boolean;
  hoursWithdrawnOrange?: boolean;
  onToggle: (dateKey: string) => void;
}

function ScheduleCellComponent({
  dateKey,
  status,
  locked,
  isCurrentMonth,
  hoverLabel,
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
        "group relative h-8 min-w-[2.25rem] border-b border-r border-border p-0 text-xs transition-colors last:border-r-0",
        statusStyles[status],
        shiftSwapPurple && isCurrentMonth
          ? "bg-violet-300 hover:bg-violet-400 dark:bg-violet-500/80 dark:hover:bg-violet-400/90"
          : "",
        // Retirada de horas (banco de horas): destaque laranja apenas quando o dia ainda é WORK.
        hoursWithdrawnOrange && isCurrentMonth && status === "WORK" && !shiftSwapPurple
          ? "bg-orange-300 hover:bg-orange-400 dark:bg-orange-500/80 dark:hover:bg-orange-400/90"
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
    >
      {hoverLabel ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-[calc(100%+8px)]",
            "whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-900 shadow-sm",
            "dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-100",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          {hoverLabel}
        </span>
      ) : null}
    </td>
  );
}

export const ScheduleCell = memo(ScheduleCellComponent);

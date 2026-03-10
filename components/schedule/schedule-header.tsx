"use client";

import type { ScheduleCalendarDay } from "@/lib/scheduleUtils";

interface ScheduleHeaderProps {
  calendarDays: ScheduleCalendarDay[];
}

const STICKY_COLUMN_WIDTH = "w-[200px]";

const STICKY_CELL_BASE =
  "sticky left-0 z-30 relative bg-background border-r border-border border-b border-border";

export function ScheduleHeader({ calendarDays }: ScheduleHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-border">
        <th
          className={`${STICKY_CELL_BASE} px-2 py-1.5 text-left font-medium text-foreground ${STICKY_COLUMN_WIDTH}`}
        >
          Nome
        </th>
        {calendarDays.map((day) => (
          <th
            key={day.dateKey}
            className="min-w-[2.25rem] border-r border-border border-b border-border px-0.5 py-1 text-center font-medium text-muted-foreground last:border-r-0"
          >
            <div className="flex flex-col items-center text-xs">
              <span className="text-muted-foreground">{day.weekdayLabel}</span>
              <span>{day.dayLabel}</span>
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

export { STICKY_COLUMN_WIDTH, STICKY_CELL_BASE };

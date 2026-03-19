"use client";

import { useEffect, useState } from "react";
import { getMemberScheduleForAdmin } from "@/server/schedule/getSchedule";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { WEEKDAY_LABELS } from "@/lib/constants";

export function MemberScheduleMiniCalendar({
  memberId,
  year,
  month,
  highlightDateKeys = [],
  highlightCurrentDateKeys,
  highlightNewDateKeys,
  className,
}: {
  memberId: string;
  year: number;
  month: number;
  highlightDateKeys?: string[];
  highlightCurrentDateKeys?: string[];
  highlightNewDateKeys?: string[];
  className?: string;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMemberScheduleForAdmin>>>(null);

  useEffect(() => {
    getMemberScheduleForAdmin(memberId, year, month).then(setData);
  }, [memberId, year, month]);

  if (!data) {
    return (
      <div
        className={`flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border/50 bg-muted/10 p-4 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        Carregando…
      </div>
    );
  }

  const statusByDate = new Map<string, "WORK" | "OFF">();
  for (const d of data.days) statusByDate.set(d.dateKey, d.status);
  const calendarDays = getScheduleCalendarDays(year, month);
  const monthLabel = (() => {
    const str = new Date(year, month - 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  })();
  const rowCount = Math.ceil(calendarDays.length / 7);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <p className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">{monthLabel}</p>
      <div
        className="grid min-h-0 flex-1 gap-1 text-xs"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: `auto repeat(${rowCount}, 1fr)`,
        }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="rounded border border-transparent bg-muted/50 flex items-center justify-center font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {calendarDays.map((day) => {
          const status = day.isCurrentMonth ? (statusByDate.get(day.dateKey) ?? "WORK") : null;
          const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
          const isAmberHighlight = highlightDateKeys.includes(day.dateKey);
          const isCurrentBlue = (highlightCurrentDateKeys ?? []).includes(day.dateKey);
          const isNewBlue = (highlightNewDateKeys ?? []).includes(day.dateKey);
          return (
            <div
              key={day.dateKey}
              className={`flex min-h-[2.8rem] flex-col items-center justify-center rounded border ${
                isNewBlue
                  ? "bg-blue-500/50 border-blue-700 text-white ring-1 ring-blue-800/50"
                  : isCurrentBlue
                    ? "bg-blue-200/60 border-blue-400 ring-1 ring-blue-500/40"
                    : isAmberHighlight
                      ? "bg-amber-400/50 border-amber-500 ring-1 ring-amber-600/50"
                  : !day.isCurrentMonth
                    ? "bg-muted/10 border-transparent opacity-50"
                    : status === "OFF"
                      ? "bg-red-500/20 border-red-500/30"
                      : "bg-green-500/20 border-green-500/30"
              }`}
            >
              {dayNum != null && <span className="text-[12px] font-medium leading-tight">{dayNum}</span>}
              {(isCurrentBlue || isNewBlue || (isAmberHighlight && !isCurrentBlue && !isNewBlue)) && (
                <span className={`text-[9px] font-semibold leading-tight mt-0.5 ${
                  isAmberHighlight ? "text-amber-900" : "text-inherit"
                }`}>
                  {isNewBlue ? "NOVO" : isCurrentBlue ? "ATUAL" : "Troca"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


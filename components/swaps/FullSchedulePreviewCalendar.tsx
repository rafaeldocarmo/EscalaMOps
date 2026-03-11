"use client";

import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import type { FullSwapPreviewMonth } from "@/server/swaps/getWeekendSwapPreview";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Agenda completa (todos os dias) após a troca de fila = escala da outra pessoa. */
export function FullSchedulePreviewCalendar({ months }: { months: FullSwapPreviewMonth[] }) {
  return (
    <div className="space-y-4">
      {months.map(({ year, month, days }) => {
        const statusByDate = new Map<string, "WORK" | "OFF">();
        for (const d of days) statusByDate.set(d.dateKey, d.status);
        const calendarDays = getScheduleCalendarDays(year, month);
        const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        return (
          <div key={`${year}-${month}`}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground capitalize">
              {monthLabel}
            </p>
            <div className="grid grid-cols-7 gap-0.5 text-xs">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="rounded border border-transparent bg-muted/50 px-0.5 py-0.5 text-center font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
              {calendarDays.map((day) => {
                const status = day.isCurrentMonth ? (statusByDate.get(day.dateKey) ?? "WORK") : null;
                const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
                return (
                  <div
                    key={day.dateKey}
                    className={`rounded border min-h-[1.75rem] flex flex-col items-center justify-center ${
                      !day.isCurrentMonth
                        ? "bg-muted/10 border-transparent opacity-50"
                        : status === "OFF"
                          ? "bg-red-500/20 border-red-500/30"
                          : "bg-green-500/25 border-green-500/40"
                    }`}
                  >
                    {dayNum != null && <span className="text-[10px] font-medium">{dayNum}</span>}
                    {day.isCurrentMonth && status === "OFF" && (
                      <span className="text-[8px]">FOLGA</span>
                    )}
                    {day.isCurrentMonth && status === "WORK" && (
                      <span className="text-[8px]">TRABALHO</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

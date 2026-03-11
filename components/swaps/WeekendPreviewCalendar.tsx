"use client";

import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import type { WeekendPreviewItem } from "@/server/swaps/getWeekendSwapPreview";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Mini agenda com fins de semana pintados conforme escala após a troca de fila. */
export function WeekendPreviewCalendar({ preview }: { preview: WeekendPreviewItem[] }) {
  const afterSwapByDate = new Map<string, "work" | "off">();
  for (const w of preview) {
    const status = w.afterSwapUserWorks ? "work" : "off";
    afterSwapByDate.set(w.saturdayDateKey, status);
    afterSwapByDate.set(w.sundayDateKey, status);
  }
  const firstSat = preview[0]?.saturdayDateKey ?? "";
  const [firstY, firstM] = firstSat
    ? firstSat.split("-").map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];
  const month2 = firstM === 12 ? { year: firstY + 1, month: 1 } : { year: firstY, month: firstM + 1 };
  const months: { year: number; month: number }[] = [
    { year: firstY, month: firstM },
    month2,
  ];

  return (
    <div className="space-y-4">
      {months.map(({ year, month }) => {
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
                const status = afterSwapByDate.get(day.dateKey);
                const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
                return (
                  <div
                    key={day.dateKey}
                    className={`rounded border min-h-[1.75rem] flex flex-col items-center justify-center ${
                      status === "work"
                        ? "bg-green-500/25 border-green-500/40"
                        : status === "off"
                          ? "bg-red-500/20 border-red-500/30"
                          : day.isCurrentMonth
                            ? "bg-muted/20 border-transparent"
                            : "bg-muted/10 border-transparent opacity-50"
                    }`}
                  >
                    {dayNum != null && <span className="text-[10px] font-medium">{dayNum}</span>}
                    {status === "work" && <span className="text-[8px]">TRABALHO</span>}
                    {status === "off" && <span className="text-[8px]">FOLGA</span>}
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

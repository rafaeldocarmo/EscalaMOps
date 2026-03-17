"use client";

import { useEffect, useState } from "react";
import { getOnCallScheduleForMember, type OnCallPeriod } from "@/server/sobreaviso/getOnCallScheduleForMember";
import { getScheduleCalendarDays, periodsToDateSet } from "@/lib/scheduleUtils";
import { WEEKDAY_LABELS } from "@/lib/constants";

export function OnCallSwapMiniCalendar({
  currentMemberId,
  newMemberId,
  year,
  month,
  className,
}: {
  currentMemberId: string;
  newMemberId: string;
  year: number;
  month: number;
  className?: string;
}) {
  const [currentPeriods, setCurrentPeriods] = useState<OnCallPeriod[]>([]);
  const [newPeriods, setNewPeriods] = useState<OnCallPeriod[]>([]);

  useEffect(() => {
    getOnCallScheduleForMember(currentMemberId, year, month).then(setCurrentPeriods);
    getOnCallScheduleForMember(newMemberId, year, month).then(setNewPeriods);
  }, [currentMemberId, newMemberId, year, month]);

  const currentDates = periodsToDateSet(currentPeriods);
  const newDates = periodsToDateSet(newPeriods);
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
          const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
          const isCurrent = currentDates.has(day.dateKey);
          const isNew = newDates.has(day.dateKey);
          let cellClass = "bg-white border-border/30";
          let label = "";
          if (!day.isCurrentMonth) {
            cellClass = "bg-muted/10 border-transparent opacity-50";
          } else if (isNew) {
            cellClass = "bg-blue-500 border-blue-600 text-white";
            label = "NOVO";
          } else if (isCurrent) {
            cellClass = "bg-blue-200 border-blue-300 text-blue-800";
            label = "ATUAL";
          }
          return (
            <div
              key={day.dateKey}
              className={`flex min-h-0 flex-col items-center justify-center rounded border ${cellClass}`}
            >
              {dayNum != null && <span className="text-[10px] font-medium">{dayNum}</span>}
              {day.isCurrentMonth && label && <span className="text-[8px] font-semibold">{label}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-200 border border-blue-300" />
          <span className="text-[10px] text-muted-foreground">Atual</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500 border border-blue-600" />
          <span className="text-[10px] text-muted-foreground">Após troca</span>
        </div>
      </div>
    </div>
  );
}


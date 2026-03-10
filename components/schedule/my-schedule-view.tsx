"use client";

import { useEffect, useState } from "react";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { MonthNavigator } from "./month-navigator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface MyScheduleViewProps {
  memberId: string;
}

export function MyScheduleView({ memberId }: MyScheduleViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMySchedule>>>(null);

  useEffect(() => {
    getMySchedule(memberId, year, month).then(setData);
  }, [memberId, year, month]);

  const calendarDays = getScheduleCalendarDays(year, month);
  const statusByDate = new Map<string, "WORK" | "OFF">();
  if (data?.days) {
    for (const d of data.days) {
      statusByDate.set(d.dateKey, d.status);
    }
  }

  const goPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Minha Escala</CardTitle>
        <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-md border bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {calendarDays.map((day) => {
            const status = day.isCurrentMonth
              ? (statusByDate.get(day.dateKey) ?? "WORK")
              : null;
            const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
            return (
              <div
                key={day.dateKey}
                className={`rounded-md border p-2 min-h-[4rem] flex flex-col items-center justify-center gap-0.5 ${
                  status === "OFF"
                    ? "bg-red-500/20 border-red-500/30"
                    : status === "WORK"
                      ? "bg-green-500/20 border-green-500/30"
                      : "bg-muted/20 border-transparent"
                }`}
              >
                {dayNum != null && <span className="text-sm font-medium">{dayNum}</span>}
                {status === "WORK" && <span className="text-[10px] font-medium">TRABALHO</span>}
                {status === "OFF" && <span className="text-[10px] font-medium">FOLGA</span>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

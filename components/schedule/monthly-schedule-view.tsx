"use client";

import { useEffect, useState } from "react";
import { getMonthlySchedule } from "@/server/schedule/getMonthlySchedule";
import {
  assignmentsToStateMap,
  buildScheduleSections,
  getScheduleCalendarDays,
} from "@/lib/scheduleUtils";
import { ScheduleGrid } from "./schedule-grid";
import { MonthNavigator } from "./month-navigator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MonthlyScheduleView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonthlySchedule>>>(null);

  useEffect(() => {
    getMonthlySchedule(year, month).then(setData);
  }, [year, month]);

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

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando…
        </CardContent>
      </Card>
    );
  }

  const { assignments, members } = data;
  const stateMap = assignmentsToStateMap(assignments);
  const sections = buildScheduleSections(members);
  const calendarDays = getScheduleCalendarDays(year, month);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Escala Mensal</CardTitle>
        <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum membro na equipe.</p>
        ) : (
          <ScheduleGrid
            sections={sections}
            calendarDays={calendarDays}
            stateMap={stateMap}
            onCellToggle={() => {}}
            locked
          />
        )}
      </CardContent>
    </Card>
  );
}

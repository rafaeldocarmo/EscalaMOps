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
import type { Level, Shift } from "@/types/team";
import { SHIFT_OPTIONS } from "@/types/team";
import { MultiSelect } from "@/components/ui/multi-select";

export function MonthlyScheduleView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonthlySchedule>>>(null);
  const [levelFilter, setLevelFilter] = useState<Level[]>(["N1", "N2"]);
  const [shiftFilter, setShiftFilter] = useState<Shift[]>(SHIFT_OPTIONS.map((s) => s.value));

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
  let visibleMembers = members;
  if (levelFilter.length > 0) {
    visibleMembers = visibleMembers.filter((m) => levelFilter.includes(m.level));
  }
  if (shiftFilter.length > 0) {
    visibleMembers = visibleMembers.filter((m) => shiftFilter.includes(m.shift));
  }

  const sections = buildScheduleSections(visibleMembers);
  const calendarDays = getScheduleCalendarDays(year, month);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Escala Mensal</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
            <MultiSelect
              label="Níveis"
              options={[
                { value: "N1", label: "N1" },
                { value: "N2", label: "N2" },
                { value: "ESPC", label: "ESPC" },
                { value: "PRODUCAO", label: "Produção" },
              ]}
              value={levelFilter}
              onChange={setLevelFilter}
              size="sm"
            />
            <MultiSelect
              label="Turnos"
              options={SHIFT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={shiftFilter}
              onChange={setShiftFilter}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visibleMembers.length === 0 ? (
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

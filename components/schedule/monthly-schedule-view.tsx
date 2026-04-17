"use client";

import { useEffect, useMemo, useState } from "react";
import {
  initialScheduleLevelFilter,
  initialScheduleShiftFilter,
  levelOptionsForScheduleFilters,
  shiftOptionsForScheduleFilters,
} from "@/lib/scheduleMemberFilterOptions";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { SobreavisoTable } from "./sobreaviso-table";
import { getSobreavisoScheduleForMonth } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import type { SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import { getShiftSwapRequestsForMonth } from "@/server/swaps/getShiftSwapRequestsForMonth";
import { getApprovedOffHoursWithdrawnDatesForMonth } from "@/server/bank-hours/getApprovedOffHoursWithdrawnDatesForMonth";

export function MonthlyScheduleView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonthlySchedule>>>(null);
  const [sobreavisoWeeks, setSobreavisoWeeks] = useState<SobreavisoWeek[]>([]);
  const [shiftSwapPurpleByMemberId, setShiftSwapPurpleByMemberId] = useState<Record<string, string[]>>({});
  const [hoursWithdrawnOrangeByMemberId, setHoursWithdrawnOrangeByMemberId] = useState<Record<string, string[]>>({});
  const [levelFilter, setLevelFilter] = useState<Level[]>(["N1", "N2"]);
  const [shiftFilter, setShiftFilter] = useState<Shift[]>([]);

  useEffect(() => {
    getMonthlySchedule(year, month).then(setData);
  }, [year, month]);

  useEffect(() => {
    if (!data) return;
    setLevelFilter(initialScheduleLevelFilter(data.memberFormCatalog));
    setShiftFilter(initialScheduleShiftFilter(data.memberFormCatalog));
  }, [data]);

  useEffect(() => {
    getSobreavisoScheduleForMonth(month, year).then(setSobreavisoWeeks);
  }, [year, month]);

  useEffect(() => {
    getShiftSwapRequestsForMonth(year, month).then((list) => {
      const map: Record<string, string[]> = {};
      for (const r of list) {
        if (!map[r.requesterId]) map[r.requesterId] = [];
        map[r.requesterId].push(r.originalDate);
      }
      setShiftSwapPurpleByMemberId(map);
    });
  }, [year, month]);

  useEffect(() => {
    getApprovedOffHoursWithdrawnDatesForMonth(year, month).then((map) => setHoursWithdrawnOrangeByMemberId(map));
  }, [year, month]);

  useEffect(() => {
    const handler = () => {
      // Recarrega a escala (8h) e também o destaque laranja (<8).
      getMonthlySchedule(year, month).then(setData);
      getApprovedOffHoursWithdrawnDatesForMonth(year, month).then(setHoursWithdrawnOrangeByMemberId);
    };
    window.addEventListener("bank-hours-updated", handler);
    return () => window.removeEventListener("bank-hours-updated", handler);
  }, [year, month]);

  const { goPrev, goNext } = useMonthNavigation({
    year,
    month,
    onYearChange: setYear,
    onMonthChange: setMonth,
  });

  const memberFormCatalog = data?.memberFormCatalog ?? null;
  const levelFilterSelectOptions = useMemo(
    () => levelOptionsForScheduleFilters(memberFormCatalog),
    [memberFormCatalog],
  );
  const shiftFilterSelectOptions = useMemo(
    () => shiftOptionsForScheduleFilters(memberFormCatalog),
    [memberFormCatalog],
  );

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
            {!data.memberFormCatalog ? (
              <p className="max-w-[220px] text-xs text-amber-700 dark:text-amber-500">
                Configure níveis e turnos da equipe para filtrar por catálogo.
              </p>
            ) : null}
            <MultiSelect
              label="Níveis"
              options={levelFilterSelectOptions}
              value={levelFilter}
              onChange={setLevelFilter}
              size="sm"
            />
            <MultiSelect
              label="Turnos"
              options={shiftFilterSelectOptions}
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
          <>
            <ScheduleGrid
              sections={sections}
              calendarDays={calendarDays}
              stateMap={stateMap}
              onCellToggle={() => {}}
              shiftSwapPurpleByMemberId={shiftSwapPurpleByMemberId}
              hoursWithdrawnOrangeByMemberId={hoursWithdrawnOrangeByMemberId}
              locked
            />
            <div className="mt-6 pt-4 border-t border-border/50">
              <h2 className="text-base font-semibold tracking-tight">Sobreaviso</h2>
              <div className="mt-3">
                <SobreavisoTable weeks={sobreavisoWeeks} calendarDays={calendarDays} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

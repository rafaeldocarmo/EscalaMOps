"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  initialScheduleLevelFilter,
  initialScheduleShiftFilter,
  levelOptionsForScheduleFilters,
  shiftOptionsForScheduleFilters,
} from "@/lib/scheduleMemberFilterOptions";
import {
  assignmentsToStateMap,
  buildScheduleSections,
  getScheduleCalendarDays,
} from "@/lib/scheduleUtils";
import { ScheduleGrid } from "./schedule-grid";
import { MonthNavigator } from "./month-navigator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { SobreavisoTable } from "./sobreaviso-table";
import {
  getMonthlyDashboardBootstrap,
  type MonthlyDashboardBootstrap,
} from "@/server/dashboard/getMonthlyDashboardBootstrap";

export function MonthlyScheduleView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bootstrap, setBootstrap] = useState<MonthlyDashboardBootstrap | null>(null);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [shiftFilter, setShiftFilter] = useState<string[]>([]);

  const loadBootstrap = useCallback(() => {
    return getMonthlyDashboardBootstrap(year, month).then(setBootstrap);
  }, [year, month]);

  useEffect(() => {
    let cancelled = false;
    getMonthlyDashboardBootstrap(year, month).then((data) => {
      if (cancelled) return;
      setBootstrap(data);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const memberFormCatalog = bootstrap?.memberFormCatalog ?? null;
  useEffect(() => {
    if (!bootstrap) return;
    setLevelFilter(initialScheduleLevelFilter(memberFormCatalog));
    setShiftFilter(initialScheduleShiftFilter(memberFormCatalog));
  }, [bootstrap, memberFormCatalog]);

  useEffect(() => {
    const handler = () => {
      loadBootstrap();
    };
    window.addEventListener("bank-hours-updated", handler);
    return () => window.removeEventListener("bank-hours-updated", handler);
  }, [loadBootstrap]);

  const { goPrev, goNext } = useMonthNavigation({
    year,
    month,
    onYearChange: setYear,
    onMonthChange: setMonth,
  });

  const levelFilterSelectOptions = useMemo(
    () => levelOptionsForScheduleFilters(memberFormCatalog),
    [memberFormCatalog],
  );
  const shiftFilterSelectOptions = useMemo(
    () => shiftOptionsForScheduleFilters(memberFormCatalog),
    [memberFormCatalog],
  );

  if (!bootstrap) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando…
        </CardContent>
      </Card>
    );
  }

  const {
    assignments,
    members,
    sobreavisoWeeks,
    shiftSwapPurpleByMemberId,
    hoursWithdrawnOrangeByMemberId,
  } = bootstrap;

  const stateMap = assignmentsToStateMap(assignments);
  let visibleMembers = members.filter((m) => m.participatesInSchedule !== false);
  if (levelFilter.length > 0) {
    visibleMembers = visibleMembers.filter((m) => levelFilter.includes(m.teamLevelId));
  }
  if (shiftFilter.length > 0) {
    visibleMembers = visibleMembers.filter((m) => shiftFilter.includes(m.teamShiftId));
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
            {!memberFormCatalog ? (
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

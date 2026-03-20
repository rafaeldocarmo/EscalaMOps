"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { type MyOnCallPeriod } from "@/server/sobreaviso/getMyOnCallSchedule";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { getApprovedOffHoursWithdrawnDatesForMonth } from "@/server/bank-hours/getApprovedOffHoursWithdrawnDatesForMonth";
import { MonthNavigator } from "./month-navigator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WEEKDAY_LABELS, MONTH_NAMES } from "@/lib/constants";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnifiedSwapForm } from "@/components/swaps/UnifiedSwapForm";
import { SwapHistoryList } from "@/components/swaps/SwapHistoryList";
import { MyScheduleQuickActions } from "@/components/schedule/my-schedule-quick-actions";
import { MyScheduleUpcomingEvents } from "@/components/schedule/my-schedule-upcoming-events";
import { BankHoursForm } from "@/components/bank-hours/BankHoursForm";

const PENDING_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"];

interface MyScheduleViewProps {
  memberId: string;
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  dashboardData?: {
    schedule: Awaited<ReturnType<typeof getMySchedule>>;
    swaps: Awaited<ReturnType<typeof getMySwapRequests>>;
    onCallPeriods: MyOnCallPeriod[];
  } | null;
}

export function MyScheduleView({
  memberId,
  year,
  month,
  onYearChange,
  onMonthChange,
  dashboardData,
}: MyScheduleViewProps) {
  const now = new Date();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMySchedule>>>(dashboardData?.schedule ?? null);
  const [swapHighlightDateKeys, setSwapHighlightDateKeys] = useState<string[]>([]);
  const [turnSwapPendingDateKeys, setTurnSwapPendingDateKeys] = useState<string[]>([]);
  const [turnSwapApprovedDateKeys, setTurnSwapApprovedDateKeys] = useState<string[]>([]);
  const [bankHourWithdrawnDateKeys, setBankHourWithdrawnDateKeys] = useState<string[]>([]);
  const [onCallPeriods, setOnCallPeriods] = useState<MyOnCallPeriod[]>(dashboardData?.onCallPeriods ?? []);
  const [swapOffModalOpen, setSwapOffModalOpen] = useState(false);
  const [swapQueueModalOpen, setSwapQueueModalOpen] = useState(false);
  const [swapOnCallModalOpen, setSwapOnCallModalOpen] = useState(false);
  const [swapTurnModalOpen, setSwapTurnModalOpen] = useState(false);
  const [bankHoursModalOpen, setBankHoursModalOpen] = useState(false);
  const [swapHistoryModalOpen, setSwapHistoryModalOpen] = useState(false);
  const searchParams = useSearchParams();

  const initialSwapHighlightKeys = useMemo(() => {
    const list = dashboardData?.swaps ?? [];
    const pending = list.filter((s) => PENDING_STATUSES.includes(s.status));
    const keys: string[] = [];
    for (const s of pending) {
      if (s.type === "OFF_SWAP" && s.originalDate) keys.push(s.originalDate);
      if (s.type === "OFF_SWAP" && s.targetDate && s.targetDate !== s.originalDate) {
        keys.push(s.targetDate);
      }
    }
    return keys;
  }, [dashboardData?.swaps]);

  const initialTurnSwapPendingDateKeys = useMemo(() => {
    const list = dashboardData?.swaps ?? [];
    const keys: string[] = [];
    for (const s of list) {
      if (s.type !== "SHIFT_SWAP" || s.originalDate == null) continue;
      if (s.status === "PENDING") keys.push(s.originalDate);
    }
    return keys;
  }, [dashboardData?.swaps]);

  const initialTurnSwapApprovedDateKeys = useMemo(() => {
    const list = dashboardData?.swaps ?? [];
    const keys: string[] = [];
    for (const s of list) {
      if (s.type !== "SHIFT_SWAP" || s.originalDate == null) continue;
      if (s.status === "APPROVED") keys.push(s.originalDate);
    }
    return keys;
  }, [dashboardData?.swaps]);

  const initialSwaps = dashboardData?.swaps;

  useEffect(() => {
    if (searchParams.get("openSwaps") === "1") {
      window.history.replaceState({}, "", "/dashboard");
      const id = setTimeout(() => setSwapHistoryModalOpen(true), 0);
      return () => clearTimeout(id);
    }
  }, [searchParams]);

  useEffect(() => {
    // Keep local state in sync with the consolidated dashboard fetch.
    if (dashboardData) {
      const id = setTimeout(() => {
        setData(dashboardData.schedule ?? null);
        setOnCallPeriods(dashboardData.onCallPeriods ?? []);
        setSwapHighlightDateKeys(initialSwapHighlightKeys);
        setTurnSwapPendingDateKeys(initialTurnSwapPendingDateKeys);
        setTurnSwapApprovedDateKeys(initialTurnSwapApprovedDateKeys);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [
    dashboardData,
    initialSwapHighlightKeys,
    initialTurnSwapPendingDateKeys,
    initialTurnSwapApprovedDateKeys,
  ]);

  useEffect(() => {
    const handler = () => {
      getMySwapRequests().then((list) => {
        const pending = list.filter((s) => PENDING_STATUSES.includes(s.status));
        const keys: string[] = [];
        const turnPendingKeys: string[] = [];
        const turnApprovedKeys: string[] = [];
        for (const s of pending) {
          if (s.type === "OFF_SWAP" && s.originalDate) keys.push(s.originalDate);
          if (s.type === "OFF_SWAP" && s.targetDate && s.targetDate !== s.originalDate) {
            keys.push(s.targetDate);
          }
        }
        for (const s of list) {
          if (s.type !== "SHIFT_SWAP" || !s.originalDate) continue;
          if (s.status === "PENDING") turnPendingKeys.push(s.originalDate);
          if (s.status === "APPROVED") turnApprovedKeys.push(s.originalDate);
        }
        setSwapHighlightDateKeys(keys);
        setTurnSwapPendingDateKeys(turnPendingKeys);
        setTurnSwapApprovedDateKeys(turnApprovedKeys);
      });
    };
    window.addEventListener("swaps-updated", handler);
    return () => window.removeEventListener("swaps-updated", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [scheduleRes, withdrawnMap] = await Promise.all([
        getMySchedule(memberId, year, month),
        getApprovedOffHoursWithdrawnDatesForMonth(year, month),
      ]);
      if (cancelled) return;

      setData(scheduleRes);
      setBankHourWithdrawnDateKeys(withdrawnMap[memberId] ?? []);
    };

    // Carrega no mount (e quando year/month mudarem) e também ao receber o evento.
    load();

    const handler = () => {
      load();
    };

    window.addEventListener("bank-hours-updated", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("bank-hours-updated", handler);
    };
  }, [memberId, year, month]);

  const calendarDays = useMemo(
    () => getScheduleCalendarDays(year, month),
    [year, month]
  );

  const statusByDate = useMemo(() => {
    const map = new Map<string, "WORK" | "OFF">();
    if (data?.days) {
      for (const d of data.days) {
        map.set(d.dateKey, d.status);
      }
    }
    return map;
  }, [data]);

  const { onCallDates, onCallTransitionDates } = useMemo(() => {
    const dates = new Set<string>();
    const transitionDates = new Set<string>();

    for (const p of onCallPeriods) {
      const start = new Date(p.startDate + "T12:00:00.000Z");
      const end = new Date(p.endDate + "T12:00:00.000Z");
      let d = new Date(start);
      while (d < end) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        dates.add(`${y}-${m}-${day}`);
        d = new Date(d.getTime() + 86400000);
      }
      const ey = end.getUTCFullYear();
      const em = String(end.getUTCMonth() + 1).padStart(2, "0");
      const ed = String(end.getUTCDate()).padStart(2, "0");
      transitionDates.add(`${ey}-${em}-${ed}`);
    }

    for (const dt of transitionDates) {
      dates.delete(dt);
    }

    return { onCallDates: dates, onCallTransitionDates: transitionDates };
  }, [onCallPeriods]);

  const { goPrev, goNext } = useMonthNavigation({
    year,
    month,
    onYearChange,
    onMonthChange,
  });

  const today = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const isViewingCurrentMonth = data && data.year === currentYear && data.month === currentMonth;
  let nextWorkLabel: string | null = null;
  let nextWorkSubtitle: string | null = null;
  let nextOffLabel: string | null = null;
  let nextOffSubtitle: string | null = null;
  if (data?.days && isViewingCurrentMonth) {
    for (const d of data.days) {
      if (d.day >= today) {
        if (d.status === "WORK" && !nextWorkLabel) {
          const isTomorrow = d.day === today + 1;
          nextWorkLabel = isTomorrow ? "Amanhã: Trabalho" : "Próximo Trabalho";
          nextWorkSubtitle = "08:00 - 17:00 • Presencial";
        }
        if (d.status === "OFF" && !nextOffLabel) {
          const dayName = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][new Date(data.year, data.month - 1, d.day).getDay()];
          nextOffLabel = "Próxima Folga";
          nextOffSubtitle = `${dayName}, ${d.day} de ${MONTH_NAMES[data.month - 1]}`;
        }
        if (nextWorkLabel && nextOffLabel) break;
      }
    }
  }

  let nextOnCallLabel: string | null = null;
  let nextOnCallSubtitle: string | null = null;
  if (onCallPeriods.length > 0 && isViewingCurrentMonth) {
    const todayKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(today).padStart(2, "0")}`;
    for (const p of onCallPeriods) {
      if (p.startDate >= todayKey) {
        const sd = new Date(p.startDate + "T12:00:00.000Z");
        const dayName = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][sd.getUTCDay()];
        nextOnCallLabel = "Próximo Sobreaviso";
        nextOnCallSubtitle = `${dayName}, ${sd.getUTCDate()} de ${MONTH_NAMES[sd.getUTCMonth()]}`;
        break;
      }
      if (p.startDate < todayKey && p.endDate > todayKey) {
        nextOnCallLabel = "Em Sobreaviso";
        const ed = new Date(p.endDate + "T12:00:00.000Z");
        nextOnCallSubtitle = `Até Sex, ${ed.getUTCDate()} de ${MONTH_NAMES[ed.getUTCMonth()]}`;
        break;
      }
    }
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-stretch">
      <div className="lg:col-span-3 min-h-0 flex flex-col">
        <Card className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg font-bold text-foreground">
              Minha Escala
            </CardTitle>
            <div className="flex items-center rounded-full border border-border bg-background px-2 py-1.5 shadow-sm">
              <MonthNavigator
                year={year}
                month={month}
                onPrevious={goPrev}
                onNext={goNext}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 pt-0">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="rounded-md border border-transparent bg-muted/50 px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
              {calendarDays.map((day) => {
                const status = day.isCurrentMonth
                  ? (statusByDate.get(day.dateKey) ?? "WORK")
                  : null;
                const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
                const isSwapHighlight = day.isCurrentMonth && swapHighlightDateKeys.includes(day.dateKey);
                const isTurnSwapPending = day.isCurrentMonth && turnSwapPendingDateKeys.includes(day.dateKey);
                const isTurnSwapApproved = day.isCurrentMonth && turnSwapApprovedDateKeys.includes(day.dateKey);
                const isTurnSwapHighlight = isTurnSwapPending || isTurnSwapApproved;
                const isBankHourWithdrawn =
                  day.isCurrentMonth &&
                  status === "WORK" &&
                  bankHourWithdrawnDateKeys.includes(day.dateKey);
                const isOnCall = day.isCurrentMonth && onCallDates.has(day.dateKey);
                const isOnCallTransition = day.isCurrentMonth && onCallTransitionDates.has(day.dateKey);
                return (
                  <div
                    key={day.dateKey}
                    className={`relative aspect-[3/2] flex min-h-[4rem] flex-col items-center justify-center gap-0.5 rounded-lg border p-2 transition-colors overflow-hidden ${
                      isTurnSwapHighlight
                        ? "border-purple-500/60 bg-purple-400/50 ring-1 ring-purple-600/40 hover:bg-purple-400/60 hover:ring-1 hover:ring-purple-600/50"
                        : isSwapHighlight
                        ? "border-amber-500/60 bg-amber-400/50 ring-1 ring-amber-600/40 hover:bg-amber-400/60 hover:ring-1 hover:ring-amber-600/50"
                          : isBankHourWithdrawn
                            ? "border-orange-500/60 bg-orange-400/50 ring-1 ring-orange-600/40 hover:bg-orange-400/60 hover:ring-1 hover:ring-orange-600/50"
                        : status === "OFF"
                          ? "border-red-500/30 bg-red-500/20 hover:bg-red-500/30 hover:ring-1 hover:ring-red-500/40"
                          : status === "WORK"
                            ? "border-green-500/30 bg-green-500/20 hover:bg-green-500/30 hover:ring-1 hover:ring-green-500/40"
                            : "border-transparent bg-muted/20"
                    }`}
                  >
                    {(isOnCall || isOnCallTransition) && (
                      <div
                        className={`absolute top-0 right-0 w-1/2 h-full ${
                          isOnCallTransition ? "bg-blue-300/50" : "bg-blue-500/40"
                        }`}
                      />
                    )}
                    {dayNum != null && (
                      <span
                        className={`relative z-10 text-sm font-semibold ${
                          isTurnSwapHighlight
                            ? "text-purple-900"
                            : isSwapHighlight
                              ? "text-amber-900"
                              : isBankHourWithdrawn
                                ? "text-orange-900"
                              : status === "OFF"
                                ? "text-red-800"
                                : "text-green-800"
                        }`}
                      >
                        {dayNum}
                      </span>
                    )}
                    {isBankHourWithdrawn && !isSwapHighlight && !isTurnSwapHighlight && (
                      <span className="relative z-10 text-[10px] font-medium text-orange-900">RETIRADA DE HORAS</span>
                    )}
                    {status === "WORK" &&
                      !isSwapHighlight &&
                      !isTurnSwapHighlight &&
                      !isBankHourWithdrawn && (
                        <span className="relative z-10 text-[10px] font-medium text-green-800">TRABALHO</span>
                      )}
                    {status === "OFF" && !isSwapHighlight && !isTurnSwapHighlight && (
                      <span className="relative z-10 text-[10px] font-medium text-red-800">FOLGA</span>
                    )}
                    {isSwapHighlight && !isTurnSwapHighlight && (
                      <span className="relative z-10 text-[10px] font-medium text-amber-900">TROCA</span>
                    )}
                    {isTurnSwapHighlight && (
                      <span className="relative z-10 text-[10px] font-medium text-purple-900">
                        {isTurnSwapPending ? "TROCA TURNO PENDENTE" : "TROCA TURNO"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500/60" aria-hidden />
                <span className="text-xs text-muted-foreground">Dia de Trabalho</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/60" aria-hidden />
                <span className="text-xs text-muted-foreground">Dia de Folga</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400" aria-hidden />
                <span className="text-xs text-muted-foreground">Troca Solicitada</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-400" aria-hidden />
                <span className="text-xs text-muted-foreground">Retirada de horas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-purple-400" aria-hidden />
                <span className="text-xs text-muted-foreground">Troca de Turno</span>
              </div>
              {onCallDates.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-500/60" aria-hidden />
                  <span className="text-xs text-muted-foreground">Sobreaviso</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-1">
        <MyScheduleQuickActions
          onSwapOff={() => setSwapOffModalOpen(true)}
          onSwapQueue={() => setSwapQueueModalOpen(true)}
          onSwapHistory={() => setSwapHistoryModalOpen(true)}
          onSwapOnCall={() => setSwapOnCallModalOpen(true)}
          onSwapTurn={() => setSwapTurnModalOpen(true)}
          onBankHours={() => setBankHoursModalOpen(true)}
          onCallEnabled={onCallDates.size !== 0 || onCallTransitionDates.size !== 0}
        />

        <MyScheduleUpcomingEvents
          nextWorkLabel={nextWorkLabel}
          nextWorkSubtitle={nextWorkSubtitle}
          nextOffLabel={nextOffLabel}
          nextOffSubtitle={nextOffSubtitle}
          nextOnCallLabel={nextOnCallLabel}
          nextOnCallSubtitle={nextOnCallSubtitle}
        />

        <Card className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="mb-0 text-sm font-bold uppercase tracking-wider text-foreground">
              Status de Trocas
            </CardTitle>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              30 DIAS
            </span>
          </CardHeader>
          <CardContent>
            <SwapHistoryList memberId={memberId} compact initialList={initialSwaps} />
          </CardContent>
        </Card>
      </div>
    </div>

      <Dialog open={swapOffModalOpen} onOpenChange={setSwapOffModalOpen}>
        {swapOffModalOpen && (
          <DialogContent className="max-w-[1000px]! max-h-[90vh] overflow-y-auto">
            <UnifiedSwapForm memberId={memberId} initialMode="off" />
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={swapQueueModalOpen} onOpenChange={setSwapQueueModalOpen}>
        {swapQueueModalOpen && (
          <DialogContent className="max-w-[1000px]! max-h-[90vh] overflow-y-auto">
            <UnifiedSwapForm memberId={memberId} initialMode="weekend" />
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={swapOnCallModalOpen} onOpenChange={setSwapOnCallModalOpen}>
        {swapOnCallModalOpen && (
          <DialogContent className="max-w-[1000px]! max-h-[90vh] overflow-y-auto">
            <UnifiedSwapForm memberId={memberId} initialMode="sobreaviso" />
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={swapTurnModalOpen} onOpenChange={setSwapTurnModalOpen}>
        {swapTurnModalOpen && (
          <DialogContent className="max-w-[1000px]! max-h-[90vh] overflow-y-auto">
            <UnifiedSwapForm memberId={memberId} initialMode="turno" />
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={swapHistoryModalOpen} onOpenChange={setSwapHistoryModalOpen}>
        {swapHistoryModalOpen && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Solicitações de troca</DialogTitle>
            </DialogHeader>
            <SwapHistoryList memberId={memberId} initialList={initialSwaps} />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={bankHoursModalOpen} onOpenChange={setBankHoursModalOpen}>
        {bankHoursModalOpen && (
          <DialogContent className="max-w-[900px]! max-h-[90vh] overflow-y-auto">
            <BankHoursForm memberId={memberId} defaultMode="extra" />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

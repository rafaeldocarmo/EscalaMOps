"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { MonthNavigator } from "./month-navigator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnifiedSwapForm } from "@/components/swaps/UnifiedSwapForm";
import { SwapHistoryList } from "@/components/swaps/SwapHistoryList";
import {
  Calendar,
  CalendarClock,
  FileText,
  MessageCircle,
  Briefcase,
  Coffee,
} from "lucide-react";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const PENDING_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface MyScheduleViewProps {
  memberId: string;
}

export function MyScheduleView({ memberId }: MyScheduleViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMySchedule>>>(null);
  const [swapHighlightDateKeys, setSwapHighlightDateKeys] = useState<string[]>([]);
  const [swapOffModalOpen, setSwapOffModalOpen] = useState(false);
  const [swapQueueModalOpen, setSwapQueueModalOpen] = useState(false);
  const [swapHistoryModalOpen, setSwapHistoryModalOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("openSwaps") === "1") {
      window.history.replaceState({}, "", "/dashboard");
      const id = setTimeout(() => setSwapHistoryModalOpen(true), 0);
      return () => clearTimeout(id);
    }
  }, [searchParams]);

  useEffect(() => {
    getMySchedule(memberId, year, month).then(setData);
  }, [memberId, year, month]);

  useEffect(() => {
    getMySwapRequests().then((list) => {
      const pending = list.filter((s) => PENDING_STATUSES.includes(s.status));
      const keys: string[] = [];
      for (const s of pending) {
        if (s.type === "OFF_SWAP" && s.originalDate) keys.push(s.originalDate);
        if (s.type === "OFF_SWAP" && s.targetDate && s.targetDate !== s.originalDate) {
          keys.push(s.targetDate);
        }
      }
      setSwapHighlightDateKeys(keys);
    });
  }, []);

  useEffect(() => {
    const handler = () => {
      getMySwapRequests().then((list) => {
        const pending = list.filter((s) => PENDING_STATUSES.includes(s.status));
        const keys: string[] = [];
        for (const s of pending) {
          if (s.type === "OFF_SWAP" && s.originalDate) keys.push(s.originalDate);
          if (s.type === "OFF_SWAP" && s.targetDate && s.targetDate !== s.originalDate) {
            keys.push(s.targetDate);
          }
        }
        setSwapHighlightDateKeys(keys);
      });
    };
    window.addEventListener("swaps-updated", handler);
    return () => window.removeEventListener("swaps-updated", handler);
  }, []);

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
                return (
                  <div
                    key={day.dateKey}
                    className={`aspect-[3/2] flex min-h-[4rem] flex-col items-center justify-center gap-0.5 rounded-lg border p-2 transition-colors ${
                      isSwapHighlight
                        ? "border-amber-500/60 bg-amber-400/50 ring-1 ring-amber-600/40 hover:bg-amber-400/60 hover:ring-1 hover:ring-amber-600/50"
                        : status === "OFF"
                          ? "border-red-500/30 bg-red-500/20 hover:bg-red-500/30 hover:ring-1 hover:ring-red-500/40"
                          : status === "WORK"
                            ? "border-green-500/30 bg-green-500/20 hover:bg-green-500/30 hover:ring-1 hover:ring-green-500/40"
                            : "border-transparent bg-muted/20"
                    }`}
                  >
                    {dayNum != null && (
                      <span
                        className={`text-sm font-semibold ${
                          isSwapHighlight ? "text-amber-900" : status === "OFF" ? "text-red-800" : "text-green-800"
                        }`}
                      >
                        {dayNum}
                      </span>
                    )}
                    {status === "WORK" && !isSwapHighlight && (
                      <span className="text-[10px] font-medium text-green-800">TRABALHO</span>
                    )}
                    {status === "OFF" && !isSwapHighlight && (
                      <span className="text-[10px] font-medium text-red-800">FOLGA</span>
                    )}
                    {isSwapHighlight && (
                      <span className="text-[10px] font-medium text-amber-900">TROCA</span>
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
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-1">
        <Card className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
              onClick={() => setSwapOffModalOpen(true)}
            >
              <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
              <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">Trocar Folga</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
              onClick={() => setSwapQueueModalOpen(true)}
            >
              <CalendarClock className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
              <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">Trocar Turno</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
              onClick={() => setSwapHistoryModalOpen(true)}
            >
              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
              <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">Ver Solicitações</span>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="group h-auto flex-col gap-2 py-3 border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
            >
              <Link href="#" className="flex flex-col items-center gap-2 group">
                <MessageCircle className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
                <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">Contatar Admin</span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextWorkLabel ? (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{nextWorkLabel}</p>
                  <p className="text-xs text-muted-foreground">{nextWorkSubtitle ?? ""}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dia de trabalho próximo.</p>
            )}
            {nextOffLabel ? (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600">
                  <Coffee className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{nextOffLabel}</p>
                  <p className="text-xs text-muted-foreground">{nextOffSubtitle ?? ""}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma folga próxima.</p>
            )}
          </CardContent>
        </Card>

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
            <SwapHistoryList memberId={memberId} compact />
          </CardContent>
        </Card>
      </div>
    </div>

      <Dialog open={swapOffModalOpen} onOpenChange={setSwapOffModalOpen}>
        <DialogContent className="max-w-[80vw]! max-h-[90vh] overflow-y-auto">
          <UnifiedSwapForm memberId={memberId} initialMode="off" />
        </DialogContent>
      </Dialog>
      <Dialog open={swapQueueModalOpen} onOpenChange={setSwapQueueModalOpen}>
        <DialogContent className="max-w-[80vw]! max-h-[90vh] overflow-y-auto">
          <UnifiedSwapForm memberId={memberId} initialMode="weekend" />
        </DialogContent>
      </Dialog>
      <Dialog open={swapHistoryModalOpen} onOpenChange={setSwapHistoryModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitações de troca</DialogTitle>
          </DialogHeader>
          <SwapHistoryList memberId={memberId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyBankHourBalance } from "@/server/bank-hours/getMyBankHourBalance";
import { createExtraHoursRequest } from "@/server/bank-hours/createExtraHoursRequest";
import { createOffHoursRequest } from "@/server/bank-hours/createOffHoursRequest";
import { MonthNavigator } from "@/components/schedule/month-navigator";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import type { MyScheduleDay } from "@/server/schedule/getMySchedule";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";

type Mode = "extra" | "off";

export function BankHoursForm({
  memberId,
  defaultMode = "extra",
}: {
  memberId: string;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Extra hours
  const [extraDateKey, setExtraDateKey] = useState<string>("");
  const [extraYear, setExtraYear] = useState<number>(new Date().getFullYear());
  const [extraMonth, setExtraMonth] = useState<number>(new Date().getMonth() + 1);
  const [extraScheduleDays, setExtraScheduleDays] = useState<MyScheduleDay[] | null>(null);
  const [extraHours, setExtraHours] = useState<string>("");
  const [extraJustification, setExtraJustification] = useState<string>("");
  const [extraSubmitting, setExtraSubmitting] = useState(false);

  // Off hours
  const [offDateKey, setOffDateKey] = useState<string>("");
  const [offYear, setOffYear] = useState<number>(new Date().getFullYear());
  const [offMonth, setOffMonth] = useState<number>(new Date().getMonth() + 1);
  const [offScheduleDays, setOffScheduleDays] = useState<MyScheduleDay[] | null>(null);
  const [offHours, setOffHours] = useState<string>("");
  const [offJustification, setOffJustification] = useState<string>("");
  const [offSubmitting, setOffSubmitting] = useState(false);

  const modeTitle = useMemo(() => {
    return mode === "extra" ? "Cadastrar horas extras" : "Solicitar folga (banco de horas)";
  }, [mode]);

  useEffect(() => {
    setTimeout(() => {
      setLoadingBalance(true);
      getMyBankHourBalance()
        .then((b) => setBalance(b))
        .catch(() => {})
        .finally(() => setLoadingBalance(false));
    }, 0);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      getMySchedule(memberId, offYear, offMonth).then((res) => {
        setOffScheduleDays(res?.days ?? []);
      });
    }, 0);
  }, [memberId, offYear, offMonth]);

  useEffect(() => {
    setTimeout(() => {
      getMySchedule(memberId, extraYear, extraMonth).then((res) => {
        setExtraScheduleDays(res?.days ?? []);
      });
    }, 0);
  }, [memberId, extraYear, extraMonth]);

  const offStatusByDate = useMemo(() => {
    const map = new Map<string, "WORK" | "OFF">();
    if (offScheduleDays) {
      for (const d of offScheduleDays) map.set(d.dateKey, d.status);
    }
    return map;
  }, [offScheduleDays]);

  const extraStatusByDate = useMemo(() => {
    const map = new Map<string, "WORK" | "OFF">();
    if (extraScheduleDays) {
      for (const d of extraScheduleDays) map.set(d.dateKey, d.status);
    }
    return map;
  }, [extraScheduleDays]);

  const calendarDays = useMemo(() => getScheduleCalendarDays(offYear, offMonth), [offYear, offMonth]);
  const calendarDaysExtra = useMemo(() => getScheduleCalendarDays(extraYear, extraMonth), [extraYear, extraMonth]);
  const { goPrev, goNext } = useMonthNavigation({
    year: offYear,
    month: offMonth,
    onYearChange: setOffYear,
    onMonthChange: setOffMonth,
  });

  const { goPrev: goPrevExtra, goNext: goNextExtra } = useMonthNavigation({
    year: extraYear,
    month: extraMonth,
    onYearChange: setExtraYear,
    onMonthChange: setExtraMonth,
  });

  const todayNoonUtcMs = useMemo(() => {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0);
  }, []);

  async function handleSubmitExtra(e: React.FormEvent) {
    e.preventDefault();
    if (extraSubmitting) return;
    if (!extraDateKey) {
      toast.error("Selecione um dia de trabalho (hoje ou anterior).");
      return;
    }
    if (!extraHours) {
      toast.error("Informe a quantidade de horas.");
      return;
    }
    const extraHoursNumber = Number(extraHours);
    if (!Number.isFinite(extraHoursNumber) || extraHoursNumber <= 0) {
      toast.error("Horas inválidas.");
      return;
    }
    setExtraSubmitting(true);
    const res = await createExtraHoursRequest(extraDateKey, extraHoursNumber, extraJustification);
    setExtraSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Solicitação de horas extras enviada. Aguarde aprovação do administrador.");
    setExtraDateKey("");
    setExtraHours("");
    setExtraJustification("");
    setBalance((prev) => prev); // não altera antes da aprovação
    window.dispatchEvent(new CustomEvent("bank-hours-updated"));
  }

  async function handleSubmitOff(e: React.FormEvent) {
    e.preventDefault();
    if (offSubmitting) return;
    if (!offDateKey) {
      toast.error("Selecione um dia de folga.");
      return;
    }
    if (!offHours) {
      toast.error("Informe a quantidade de horas.");
      return;
    }
    if (!offJustification || offJustification.trim().length < 2) {
      toast.error("Informe a justificativa.");
      return;
    }
    const offHoursNumber = Number(offHours);
    if (!Number.isFinite(offHoursNumber) || offHoursNumber <= 0 || offHoursNumber > 8) {
      toast.error("Horas inválidas.");
      return;
    }
    setOffSubmitting(true);
    const res = await createOffHoursRequest(offDateKey, offHoursNumber, offJustification);
    setOffSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Solicitação de folga enviada. Aguarde aprovação do administrador.");
    setOffDateKey("");
    setOffHours("");
    setOffJustification("");
    window.dispatchEvent(new CustomEvent("bank-hours-updated"));
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">{modeTitle}</CardTitle>
        <div className="mt-1 text-xs text-muted-foreground">
          Saldo atual: <strong className="text-foreground">{balance.toFixed(2)} horas</strong>
          {loadingBalance ? " (carregando...)" : ""}
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mt-3">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="extra">Horas extras</TabsTrigger>
            <TabsTrigger value="off">Folga</TabsTrigger>
          </TabsList>
          <TabsContent value="extra">
            <CardContent className="p-0 mt-2">
              <form onSubmit={handleSubmitExtra} className="space-y-3">
                <div className="space-y-2">
                  <div className="flex flex-col items-center gap-2">
                    <MonthNavigator year={extraYear} month={extraMonth} onPrevious={goPrevExtra} onNext={goNextExtra} />
                    {extraDateKey ? (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        Dia selecionado: <span className="text-foreground">{extraDateKey}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Selecione um dia de trabalho (hoje ou anterior).</div>
                    )}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {WEEKDAY_LABELS.map((label) => (
                      <div
                        key={label}
                        className="rounded border border-transparent bg-muted/50 px-1 py-0.5 text-center font-medium text-muted-foreground"
                      >
                        {label}
                      </div>
                    ))}

                    {calendarDaysExtra.map((day) => {
                      const status = day.isCurrentMonth ? (extraStatusByDate.get(day.dateKey) ?? "WORK") : null;
                      const dayNum = day.isCurrentMonth ? day.dayLabel : null;
                      const isWork = status === "WORK";
                      const isFuture = day.isCurrentMonth
                        ? new Date(day.dateKey + "T12:00:00.000Z").getTime() > todayNoonUtcMs
                        : false;
                      const selectable = day.isCurrentMonth && isWork && !isFuture;
                      const isSelected = extraDateKey === day.dateKey;

                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          disabled={!selectable}
                          onClick={() => {
                            if (!selectable) return;
                            setExtraDateKey(day.dateKey);
                          }}
                          className={`rounded border min-h-[2rem] flex flex-col items-center justify-center ${
                            !day.isCurrentMonth
                              ? "bg-muted/10 border-transparent opacity-50 cursor-default"
                              : selectable
                                ? isSelected
                                  ? "bg-purple-500/25 border-purple-700/50 ring-1 ring-purple-600/60"
                                  : "bg-green-500/20 border-green-500/30 hover:bg-green-500/25"
                                : isSelected
                                  ? "bg-purple-500/25 border-purple-700/50 opacity-70"
                                  : "bg-muted/10 border-transparent opacity-40 cursor-default"
                          }`}
                        >
                          {dayNum ? <span className="text-[10px] font-medium">{parseInt(dayNum, 10)}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="extra-hours">Horas</Label>
                  <Input
                    id="extra-hours"
                    type="number"
                    inputMode="decimal"
                    step={0.25}
                    value={extraHours}
                    onChange={(e) => setExtraHours(e.target.value)}
                    min={0}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="extra-just">Justificativa</Label>
                  <textarea
                    id="extra-just"
                    value={extraJustification}
                    onChange={(e) => setExtraJustification(e.target.value)}
                    placeholder="Ex.: trabalho extra no dia X"
                    rows={3}
                    className="w-full resize-y rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={extraSubmitting}>
                    {extraSubmitting ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </TabsContent>
          <TabsContent value="off">
            <CardContent className="p-0 mt-2">
              <form onSubmit={handleSubmitOff} className="space-y-3">
                <div className="space-y-2">
                  <div className="flex flex-col items-center gap-2">
                    <MonthNavigator year={offYear} month={offMonth} onPrevious={goPrev} onNext={goNext} />
                    {offDateKey ? (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        Dia selecionado: <span className="text-foreground">{offDateKey}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Selecione um dia de trabalho (futuro).</div>
                    )}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {WEEKDAY_LABELS.map((label) => (
                      <div key={label} className="rounded border border-transparent bg-muted/50 px-1 py-0.5 text-center font-medium text-muted-foreground">
                        {label}
                      </div>
                    ))}
                    {calendarDays.map((day) => {
                      const status = day.isCurrentMonth ? (offStatusByDate.get(day.dateKey) ?? "WORK") : null;
                      const dayNum = day.isCurrentMonth ? day.dayLabel : null;
                      const isWork = status === "WORK";
                      const isFuture = day.isCurrentMonth
                        ? new Date(day.dateKey + "T12:00:00.000Z").getTime() > todayNoonUtcMs
                        : false;
                      const selectable = day.isCurrentMonth && isWork && isFuture;
                      const isSelected = offDateKey === day.dateKey;

                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          disabled={!selectable}
                          onClick={() => {
                            if (!selectable) return;
                            setOffDateKey(day.dateKey);
                          }}
                          className={`rounded border min-h-[2rem] flex flex-col items-center justify-center ${
                            !day.isCurrentMonth
                              ? "bg-muted/10 border-transparent opacity-50 cursor-default"
                              : selectable
                                ? isSelected
                                  ? "bg-purple-500/25 border-purple-700/50 ring-1 ring-purple-600/60"
                                  : "bg-green-500/20 border-green-500/30 hover:bg-green-500/25"
                                : isSelected
                                  ? "bg-purple-500/25 border-purple-700/50 opacity-70"
                                  : "bg-muted/10 border-transparent opacity-40 cursor-default"
                          }`}
                        >
                          {dayNum ? <span className="text-[10px] font-medium">{parseInt(dayNum, 10)}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="off-hours">Horas a usar</Label>
                  <Input
                    id="off-hours"
                    type="number"
                    inputMode="decimal"
                    step={0.25}
                    value={offHours}
                    onChange={(e) => setOffHours(e.target.value)}
                    min={0}
                    max={8}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="off-just">Justificativa</Label>
                  <textarea
                    id="off-just"
                    value={offJustification}
                    onChange={(e) => setOffJustification(e.target.value)}
                    placeholder="Ex.: folga para compromisso pessoal no dia X"
                    rows={3}
                    className="w-full resize-y rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Será validado seu saldo disponível antes da solicitação.
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={offSubmitting}>
                    {offSubmitting ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </CardHeader>
    </Card>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { createOffSwapRequest } from "@/server/swaps/createOffSwapRequest";
import { MonthNavigator } from "@/components/schedule/month-navigator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface OffSwapFormProps {
  memberId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Solicitar troca"}
    </Button>
  );
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

export function OffSwapForm({ memberId }: OffSwapFormProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMySchedule>>>(null);
  const [originalDate, setOriginalDate] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getMySchedule(memberId, year, month).then(setData);
  }, [memberId, year, month]);

  const statusByDate = new Map<string, "WORK" | "OFF">();
  if (data?.days) {
    for (const d of data.days) {
      statusByDate.set(d.dateKey, d.status);
    }
  }

  const calendarDays = getScheduleCalendarDays(year, month);

  const goPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  function handleDayClick(dateKey: string) {
    const status = statusByDate.get(dateKey) ?? "WORK";
    if (status === "OFF") {
      setOriginalDate(dateKey);
      setTargetDate("");
    } else if (status === "WORK" && originalDate && dateKey !== originalDate) {
      setTargetDate(dateKey);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!originalDate || !targetDate) {
      setMessage({ type: "error", text: "Selecione uma folga e depois a nova data na agenda." });
      return;
    }
    const result = await createOffSwapRequest(originalDate, targetDate);
    if (result.success) {
      setMessage({ type: "success", text: "Solicitação enviada. Aguarde aprovação do administrador." });
      setOriginalDate("");
      setTargetDate("");
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  const canSubmit = Boolean(originalDate && targetDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Trocar dia de folga</CardTitle>
        <p className="text-sm text-muted-foreground">
          Clique em uma folga (vermelho) e depois no dia que será sua nova folga (verde). A alteração só vale após aprovação.
        </p>
        <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1 text-xs">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="rounded border border-transparent bg-muted/50 px-1 py-0.5 text-center font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {calendarDays.map((day) => {
            const status = day.isCurrentMonth
              ? (statusByDate.get(day.dateKey) ?? "WORK")
              : null;
            const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
            const isOff = status === "OFF";
            const isWork = status === "WORK";
            const isSelectedOriginal = originalDate === day.dateKey;
            const isSelectedTarget = targetDate === day.dateKey;
            const clickable = day.isCurrentMonth && (isOff || (isWork && originalDate && day.dateKey !== originalDate));

            return (
              <button
                key={day.dateKey}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && handleDayClick(day.dateKey)}
                className={`rounded border min-h-[2rem] flex flex-col items-center justify-center gap-0 ${
                  !day.isCurrentMonth
                    ? "bg-muted/20 border-transparent opacity-50"
                    : isOff
                      ? "bg-red-500/20 border-red-500/30 hover:bg-red-500/30"
                      : isWork
                        ? "bg-green-500/20 border-green-500/30 hover:bg-green-500/30"
                        : "bg-muted/20 border-transparent"
                } ${clickable ? "cursor-pointer" : "cursor-default"} ${
                  isSelectedOriginal ? "ring-2 ring-red-600 ring-offset-2" : ""
                } ${isSelectedTarget ? "ring-2 ring-green-600 ring-offset-2" : ""}`}
              >
                {dayNum != null && <span className="text-xs font-medium">{dayNum}</span>}
                {day.isCurrentMonth && isOff && <span className="text-[9px]">FOLGA</span>}
                {day.isCurrentMonth && isWork && !isOff && <span className="text-[9px]">TRABALHO</span>}
              </button>
            );
          })}
        </div>

        {canSubmit && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              Deseja trocar o dia <strong>{formatDayLabel(originalDate)}</strong> (folga) pelo dia <strong>{formatDayLabel(targetDate)}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              A folga sairá de {formatDayLabel(originalDate)} e passará para {formatDayLabel(targetDate)}. Aguarde aprovação do administrador.
            </p>
            {message && (
              <p
                className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
              >
                {message.text}
              </p>
            )}
            <div className="flex gap-2">
              <SubmitButton />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOriginalDate("");
                  setTargetDate("");
                  setMessage(null);
                }}
              >
                Limpar
              </Button>
            </div>
          </form>
        )}

        {!canSubmit && originalDate && (
          <p className="text-xs text-muted-foreground">
            Agora clique em um dia de <strong>trabalho</strong> (verde) para ser sua nova folga.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

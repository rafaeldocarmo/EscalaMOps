"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { getMembersForQueueSwap } from "@/server/swaps/getMembersForQueueSwap";
import { getFullQueueSwapPreview } from "@/server/swaps/getWeekendSwapPreview";
import { FullSchedulePreviewCalendar } from "@/components/swaps/FullSchedulePreviewCalendar";
import { createOffSwapRequest } from "@/server/swaps/createOffSwapRequest";
import { createQueueSwapRequest } from "@/server/swaps/createQueueSwapRequest";
import { MonthNavigator } from "@/components/schedule/month-navigator";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type SwapMode = "off" | "weekend";

interface UnifiedSwapFormProps {
  memberId: string;
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

function SubmitButtonOff() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Solicitar troca"}
    </Button>
  );
}

function SubmitButtonQueue() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Solicitar troca de fila"}
    </Button>
  );
}

export function UnifiedSwapForm({ memberId }: UnifiedSwapFormProps) {
  const [mode, setMode] = useState<SwapMode>("off");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMySchedule>>>(null);
  const [originalDate, setOriginalDate] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [queueMembers, setQueueMembers] = useState<{ id: string; name: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [fullPreview, setFullPreview] = useState<Awaited<ReturnType<typeof getFullQueueSwapPreview>>>(null);

  useEffect(() => {
    getMySchedule(memberId, year, month).then(setData);
  }, [memberId, year, month]);

  useEffect(() => {
    if (mode === "weekend") getMembersForQueueSwap().then(setQueueMembers);
  }, [mode]);

  useEffect(() => {
    if (mode === "weekend" && selectedMemberId) {
      getFullQueueSwapPreview(selectedMemberId).then(setFullPreview);
    } else {
      setFullPreview(null);
    }
  }, [mode, selectedMemberId]);

  const statusByDate = new Map<string, "WORK" | "OFF">();
  if (data?.days) {
    for (const d of data.days) statusByDate.set(d.dateKey, d.status);
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

  const handleDayClick = (dateKey: string) => {
    if (mode !== "off") return;
    const status = statusByDate.get(dateKey) ?? "WORK";
    if (status === "OFF") {
      setOriginalDate(dateKey);
      setTargetDate("");
    } else if (status === "WORK" && originalDate && dateKey !== originalDate) {
      setTargetDate(dateKey);
    }
  };

  const canSubmitOff = Boolean(originalDate && targetDate);

  async function handleSubmitOff(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!originalDate || !targetDate) return;
    const result = await createOffSwapRequest(originalDate, targetDate);
    if (result.success) {
      setMessage({ type: "success", text: "Solicitação enviada. Aguarde aprovação do administrador." });
      setOriginalDate("");
      setTargetDate("");
      toast.success("Troca solicitada com sucesso.");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("swaps-updated"));
    } else setMessage({ type: "error", text: result.error });
  }

  async function handleSubmitQueue(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!selectedMemberId) {
      setMessage({ type: "error", text: "Selecione um colega para trocar a posição na fila." });
      return;
    }
    const result = await createQueueSwapRequest(selectedMemberId);
    if (result.success) {
      setMessage({ type: "success", text: "Solicitação enviada. O outro membro precisa aceitar e, em seguida, um administrador aprovará." });
      setSelectedMemberId("");
      setFullPreview(null);
      toast.success("Troca solicitada com sucesso.");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("swaps-updated"));
    } else setMessage({ type: "error", text: result.error });
  }

  const isOffMode = mode === "off";
  const isWeekendMode = mode === "weekend";
  const calendarClickable = isOffMode;

  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg">Solicitar troca</CardTitle>
        <div className="flex gap-2 rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMode("off")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isOffMode ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Trocar dia de folga
          </button>
          <button
            type="button"
            onClick={() => setMode("weekend")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isWeekendMode ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Trocar final de semana
          </button>
        </div>
        {isOffMode && (
          <p className="text-sm text-muted-foreground">
            Clique em uma folga (vermelho) e depois no dia que será sua nova folga (verde).
          </p>
        )}
        {isWeekendMode && (
          <p className="text-sm text-muted-foreground my-2">
            Escolha um colega do mesmo nível e turno. A agenda abaixo mostra como ficará sua escala de fins de semana após a troca.
          </p>
        )}
        {isWeekendMode && (
          <div className="mb-3">
            <p className="mb-2 text-sm font-medium">Trocar com:</p>
            <div className="flex flex-wrap gap-2">
              {queueMembers.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant={selectedMemberId === m.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMemberId(selectedMemberId === m.id ? "" : m.id)}
                >
                  {m.name}
                </Button>
              ))}
              {queueMembers.length === 0 && (
                <span className="text-sm text-muted-foreground">Nenhum colega do mesmo nível/turno</span>
              )}
            </div>
          </div>
        )}
        <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Agenda mensal (sempre visível) */}
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
            const status = day.isCurrentMonth ? (statusByDate.get(day.dateKey) ?? "WORK") : null;
            const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
            const isOff = status === "OFF";
            const isWork = status === "WORK";
            const isSelectedOriginal = originalDate === day.dateKey;
            const isSelectedTarget = targetDate === day.dateKey;
            const clickable = calendarClickable && day.isCurrentMonth && (isOff || (isWork && originalDate && day.dateKey !== originalDate));

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

        {/* Modo: Trocar dia de folga — confirmação */}
        {isOffMode && canSubmitOff && (
          <form onSubmit={handleSubmitOff} className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              Deseja trocar o dia <strong>{formatDayLabel(originalDate)}</strong> (folga) pelo dia <strong>{formatDayLabel(targetDate)}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              A folga sairá de {formatDayLabel(originalDate)} e passará para {formatDayLabel(targetDate)}. Aguarde aprovação do administrador.
            </p>
            {message && (
              <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
                {message.text}
              </p>
            )}
            <div className="flex gap-2">
              <SubmitButtonOff />
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

        {isOffMode && !canSubmitOff && originalDate && (
          <p className="text-xs text-muted-foreground">
            Agora clique em um dia de <strong>trabalho</strong> (verde) para ser sua nova folga.
          </p>
        )}

        {/* Modo: Trocar final de semana — preview e envio */}
        {isWeekendMode && (
          <div className="space-y-3">
            {selectedMemberId && fullPreview && fullPreview.length > 0 && (
              <>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-3 text-sm font-medium">Como ficará sua escala após a troca (seus fins de semana e folgas da semana passam a ser os da outra pessoa)</p>
                  <FullSchedulePreviewCalendar months={fullPreview} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500/30 border border-green-500/50 align-middle mr-1" /> Trabalho
                    {" · "}
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30 align-middle mr-1" /> Folga
                  </p>
                </div>
                <form onSubmit={handleSubmitQueue} className="space-y-2">
                  {message && (
                    <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
                      {message.text}
                    </p>
                  )}
                  <SubmitButtonQueue />
                </form>
              </>
            )}

            {isWeekendMode && selectedMemberId && !fullPreview?.length && (
              <p className="text-xs text-muted-foreground">Carregando preview…</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getFullQueueSwapPreview } from "@/server/swaps/getWeekendSwapPreview";
import type { FullSwapPreviewMonth } from "@/server/swaps/getWeekendSwapPreview";
import { acceptQueueSwap } from "@/server/swaps/acceptQueueSwap";
import { rejectQueueSwapAsTarget } from "@/server/swaps/rejectQueueSwapAsTarget";
import { cancelSwapRequest } from "@/server/swaps/cancelSwapRequest";
import { getOnCallScheduleForMember, type OnCallPeriod } from "@/server/sobreaviso/getOnCallScheduleForMember";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import type { SwapRequestRow } from "@/types/swaps";
import { FullSchedulePreviewCalendar } from "@/components/swaps/FullSchedulePreviewCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

const WEEKDAY_LABELS_OC = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function periodsToDateSet(periods: OnCallPeriod[]): Set<string> {
  const set = new Set<string>();
  for (const p of periods) {
    const start = new Date(p.startDate + "T12:00:00.000Z");
    const end = new Date(p.endDate + "T12:00:00.000Z");
    let d = new Date(start);
    while (d < end) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      set.add(`${y}-${m}-${day}`);
      d = new Date(d.getTime() + 86400000);
    }
  }
  return set;
}

function OnCallPreviewCalendar({
  currentMemberId,
  newMemberId,
  year,
  month,
}: {
  currentMemberId: string;
  newMemberId: string;
  year: number;
  month: number;
}) {
  const [currentPeriods, setCurrentPeriods] = useState<OnCallPeriod[]>([]);
  const [newPeriods, setNewPeriods] = useState<OnCallPeriod[]>([]);

  useEffect(() => {
    getOnCallScheduleForMember(currentMemberId, year, month).then(setCurrentPeriods);
    getOnCallScheduleForMember(newMemberId, year, month).then(setNewPeriods);
  }, [currentMemberId, newMemberId, year, month]);

  const currentDates = periodsToDateSet(currentPeriods);
  const newDates = periodsToDateSet(newPeriods);
  const calendarDays = getScheduleCalendarDays(year, month);
  const monthLabel = (() => {
    const str = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return str.charAt(0).toUpperCase() + str.slice(1);
  })();

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {WEEKDAY_LABELS_OC.map((label) => (
          <div key={label} className="rounded border border-transparent bg-muted/50 px-1 py-0.5 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {calendarDays.map((day) => {
          const dayNum = day.isCurrentMonth ? parseInt(day.dayLabel, 10) : null;
          const isCurrent = currentDates.has(day.dateKey);
          const isNew = newDates.has(day.dateKey);
          let cellClass = "bg-white border-border/30";
          let label = "";
          if (!day.isCurrentMonth) {
            cellClass = "bg-muted/10 border-transparent opacity-50";
          } else if (isNew) {
            cellClass = "bg-blue-500 border-blue-600 text-white";
            label = "NOVO";
          } else if (isCurrent) {
            cellClass = "bg-blue-200 border-blue-300 text-blue-800";
            label = "ATUAL";
          }
          return (
            <div key={day.dateKey} className={`rounded border min-h-[2rem] flex flex-col items-center justify-center gap-0 ${cellClass}`}>
              {dayNum != null && <span className="text-[10px] font-medium">{dayNum}</span>}
              {day.isCurrentMonth && label && <span className="text-[8px] font-semibold">{label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateKeyToDDMM(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

function getStatusDisplay(status: SwapRequestRow["status"]): { label: string; className: string } {
  switch (status) {
    case "APPROVED":
      return { label: "Aprovada", className: "bg-green-500/20 text-green-700 border-green-500/40" };
    case "REJECTED":
      return { label: "Recusada", className: "bg-red-500/20 text-red-700 border-red-500/40" };
    case "CANCELLED":
      return { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" };
    case "PENDING":
    case "WAITING_SECOND_USER":
    case "SECOND_USER_ACCEPTED":
    default:
      return { label: "Pendente", className: "bg-amber-500/20 text-amber-800 border-amber-500/40" };
  }
}

function getDescription(row: SwapRequestRow): string {
  if (row.type === "OFF_SWAP" && row.originalDate && row.targetDate) {
    return `Troca da folga do dia ${formatDateKeyToDDMM(row.originalDate)} para o dia ${formatDateKeyToDDMM(row.targetDate)}.`;
  }
  if (row.type === "QUEUE_SWAP" && row.targetMemberName) {
    return `Troca de fila com ${row.targetMemberName}.`;
  }
  if (row.type === "ONCALL_SWAP" && row.targetMemberName) {
    return `Troca de sobreaviso com ${row.targetMemberName}.`;
  }
  if (row.type === "ONCALL_SWAP") return "Troca de sobreaviso.";
  return row.type === "OFF_SWAP" ? "Troca de folga." : "Troca de fila.";
}

const PAGE_SIZE = 3;

export interface SwapHistoryListProps {
  memberId: string;
  /** When true, renders compact list for embedding in Status card (max height + scroll) */
  compact?: boolean;
  /** When provided, avoids loading on mount (reduces initial requests). */
  initialList?: SwapRequestRow[];
}

export function SwapHistoryList({ memberId, compact, initialList }: SwapHistoryListProps) {
  const [list, setList] = useState<SwapRequestRow[]>(() => initialList ?? []);
  const [page, setPage] = useState(1);
  const [viewSwapModalRequestId, setViewSwapModalRequestId] = useState<string | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<FullSwapPreviewMonth[] | null>(null);
  const [previewData, setPreviewData] = useState<FullSwapPreviewMonth[] | null>(null);

  const load = () => getMySwapRequests().then(setList);

  useEffect(() => {
    if (initialList) return;
    load();
  }, [initialList]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("swaps-updated", handler);
    return () => window.removeEventListener("swaps-updated", handler);
  }, []);

  const viewSwapItem = viewSwapModalRequestId ? list.find((s) => s.id === viewSwapModalRequestId) ?? null : null;

  useEffect(() => {
    if (!viewSwapModalRequestId || !viewSwapItem) {
      setTimeout(() => {
        setPreviewData(null);
        setCurrentSchedule(null);
      }, 0);
      return;
    }
    if (viewSwapItem.type === "ONCALL_SWAP") {
      setTimeout(() => {
        setPreviewData(null);
        setCurrentSchedule(null);
      }, 0);
      return;
    }
    if (viewSwapItem.type !== "QUEUE_SWAP" || !viewSwapItem.requesterId) {
      setTimeout(() => {
        setPreviewData(null);
        setCurrentSchedule(null);
      }, 0);
      return;
    }
    setTimeout(() => {
      setPreviewData(null);
      setCurrentSchedule(null);
    }, 0);
    getFullQueueSwapPreview(viewSwapItem.requesterId).then((data) => {
      setPreviewData(data ?? null);
    });
    const now = new Date();
    const y1 = now.getFullYear();
    const m1 = now.getMonth() + 1;
    const m2 = m1 === 12 ? 1 : m1 + 1;
    const y2 = m1 === 12 ? y1 + 1 : y1;
    Promise.all([
      getMySchedule(memberId, y1, m1),
      getMySchedule(memberId, y2, m2),
    ]).then(([r1, r2]) => {
      const months: FullSwapPreviewMonth[] = [];
      if (r1) months.push({ year: r1.year, month: r1.month, days: r1.days.map((d) => ({ dateKey: d.dateKey, status: d.status })) });
      if (r2) months.push({ year: r2.year, month: r2.month, days: r2.days.map((d) => ({ dateKey: d.dateKey, status: d.status })) });
      setCurrentSchedule(months.length > 0 ? months : null);
    });
  }, [viewSwapModalRequestId, viewSwapItem, list, memberId]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) {
      setTimeout(() => setPage(totalPages), 0);
    }
  }, [page, totalPages]);

  const canAcceptAsTarget = (s: SwapRequestRow) =>
    (s.type === "QUEUE_SWAP" || s.type === "ONCALL_SWAP" || s.type === "OFF_SWAP") &&
    s.status === "WAITING_SECOND_USER" &&
    s.targetMemberId === memberId;

  const canCancel = (s: SwapRequestRow) =>
    s.requesterId === memberId &&
    (s.status === "PENDING" || s.status === "WAITING_SECOND_USER" || s.status === "SECOND_USER_ACCEPTED");

  const handleAccept = async (id: string) => {
    const result = await acceptQueueSwap(id);
    if (result.success) load();
    else alert(result.error);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Excluir esta solicitação?")) return;
    const result = await cancelSwapRequest(id);
    if (result.success) load();
    else alert(result.error);
  };

  const handleReject = async (id: string) => {
    if (!confirm("Recusar esta solicitação de troca?")) return;
    const result = await rejectQueueSwapAsTarget(id);
    if (result.success) load();
    else alert(result.error);
  };

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-muted/30 px-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <HelpCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-3 text-base font-semibold text-foreground">
          Nenhuma solicitação
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Você não possui trocas de turno ou folga pendentes.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className={`space-y-3 ${compact ? "max-h-[280px] overflow-auto" : ""}`}>
        {pageItems.map((s) => {
          const statusDisplay = getStatusDisplay(s.status);
          const createdDate = new Date(s.createdAt);
          return (
            <li key={s.id} className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
              <p className="text-xs text-muted-foreground">
                Data de solicitação: <strong className="text-foreground">{formatDate(createdDate)}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Solicitante: <strong className="text-foreground">{s.requesterName}</strong>
              </p>
              <p>
                <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${statusDisplay.className}`}>
                  {statusDisplay.label}
                </span>
              </p>
              <p className="text-muted-foreground">{getDescription(s)}</p>
              {s.justification && s.justification.trim().length > 0 ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  <span className="font-semibold text-foreground">Justificativa:</span>{" "}
                  {s.justification}
                </p>
              ) : null}

              {canAcceptAsTarget(s) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleAccept(s.id)}>
                    Aceitar troca
                  </Button>
                  {s.type !== "OFF_SWAP" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewSwapModalRequestId(s.id)}
                    >
                      Ver troca
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => handleReject(s.id)}>
                    Recusar
                  </Button>
                </div>
              )}

              {canCancel(s) && (
                <Button size="sm" variant="ghost" className="mt-2 text-destructive hover:text-destructive" onClick={() => handleCancel(s.id)}>
                  Excluir
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {list.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!viewSwapModalRequestId} onOpenChange={(open) => !open && setViewSwapModalRequestId(null)}>
        <DialogContent className="max-w-[1000px]! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewSwapItem?.type === "ONCALL_SWAP" ? "Comparação de sobreaviso" : "Comparação de agendas"}
            </DialogTitle>
          </DialogHeader>
          {viewSwapItem?.type === "ONCALL_SWAP" && viewSwapItem.requesterId ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Seu sobreaviso após a troca
                </p>
                <OnCallPreviewCalendar
                  currentMemberId={memberId}
                  newMemberId={viewSwapItem.requesterId}
                  year={new Date().getFullYear()}
                  month={new Date().getMonth() + 1}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-blue-200 border border-blue-300" />
                  <span className="text-xs text-muted-foreground">Seu sobreaviso atual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-blue-500 border border-blue-600" />
                  <span className="text-xs text-muted-foreground">Sobreaviso após troca</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] items-center">
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Sua agenda atual</p>
                  {currentSchedule === null ? (
                    <p className="text-sm text-muted-foreground">Carregando…</p>
                  ) : currentSchedule.length > 0 ? (
                    <FullSchedulePreviewCalendar months={currentSchedule} />
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div className="flex items-center justify-center pt-8 text-muted-foreground">
                  <span className="text-2xl" aria-hidden>→</span>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Sua agenda após a troca</p>
                  {previewData === null ? (
                    <p className="text-sm text-muted-foreground">Carregando…</p>
                  ) : previewData.length > 0 ? (
                    <FullSchedulePreviewCalendar months={previewData} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Não foi possível carregar.</p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="inline-block h-3 w-3 rounded-sm border border-green-500/50 bg-green-500/30 align-middle mr-1" /> Trabalho
                {" · "}
                <span className="inline-block h-3 w-3 rounded-sm border border-red-500/30 bg-red-500/20 align-middle mr-1" /> Folga
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

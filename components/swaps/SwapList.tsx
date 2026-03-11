"use client";

import { useEffect, useState } from "react";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getFullQueueSwapPreview } from "@/server/swaps/getWeekendSwapPreview";
import type { FullSwapPreviewMonth } from "@/server/swaps/getWeekendSwapPreview";
import { acceptQueueSwap } from "@/server/swaps/acceptQueueSwap";
import { rejectQueueSwapAsTarget } from "@/server/swaps/rejectQueueSwapAsTarget";
import { cancelSwapRequest } from "@/server/swaps/cancelSwapRequest";
import type { SwapRequestRow } from "@/types/swaps";
import { FullSchedulePreviewCalendar } from "@/components/swaps/FullSchedulePreviewCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  return row.type === "OFF_SWAP" ? "Troca de folga." : "Troca de fila.";
}

const PAGE_SIZE = 3;

interface SwapListProps {
  memberId: string;
}

export function SwapList({ memberId }: SwapListProps) {
  const [list, setList] = useState<SwapRequestRow[]>([]);
  const [page, setPage] = useState(1);
  const [viewSwapModalRequestId, setViewSwapModalRequestId] = useState<string | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<FullSwapPreviewMonth[] | null>(null);
  const [previewData, setPreviewData] = useState<FullSwapPreviewMonth[] | null>(null);

  const load = () => getMySwapRequests().then(setList);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("swaps-updated", handler);
    return () => window.removeEventListener("swaps-updated", handler);
  }, []);

  useEffect(() => {
    if (!viewSwapModalRequestId) {
      setPreviewData(null);
      setCurrentSchedule(null);
      return;
    }
    const item = list.find((s) => s.id === viewSwapModalRequestId);
    if (!item || item.type !== "QUEUE_SWAP" || !item.requesterId) {
      setPreviewData(null);
      setCurrentSchedule(null);
      return;
    }
    setPreviewData(null);
    setCurrentSchedule(null);
    getFullQueueSwapPreview(item.requesterId).then((data) => {
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
  }, [viewSwapModalRequestId, list, memberId]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  // Ajustar página atual se ficar inválida após filtro/recarregamento
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [page, totalPages]);

  const canAcceptAsTarget = (s: SwapRequestRow) =>
    s.type === "QUEUE_SWAP" &&
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
      <Card className="h-full flex flex-col min-h-0">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-base">Histórico de solicitações</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <p className="text-sm text-muted-foreground">Nenhuma solicitação de troca.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">Histórico de solicitações</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <ul className="space-y-3 flex-1 min-h-0 overflow-auto">
          {pageItems.map((s) => {
            const statusDisplay = getStatusDisplay(s.status);
            const createdDate = new Date(s.createdAt);
            return (
              <li key={s.id} className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
                <p className="text-xs text-muted-foreground">
                  Data de solicitação: <strong className="text-foreground">{formatDate(createdDate)}</strong>
                </p>
                <p>
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </span>
                </p>
                <p className="text-muted-foreground">{getDescription(s)}</p>

                {canAcceptAsTarget(s) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleAccept(s.id)}>
                      Aceitar troca
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewSwapModalRequestId(s.id)}
                    >
                      Ver troca
                    </Button>
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
      </CardContent>

      <Dialog open={!!viewSwapModalRequestId} onOpenChange={(open) => !open && setViewSwapModalRequestId(null)}>
        <DialogContent className="w-[80vw]! max-w-[80vw]! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparação de agendas</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </Card>
  );
}

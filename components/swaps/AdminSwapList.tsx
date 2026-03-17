"use client";

import { useEffect, useState } from "react";
import { getSwapRequestsForAdmin } from "@/server/swaps/getSwaps";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { approveSwap } from "@/server/swaps/approveSwap";
import { rejectSwap } from "@/server/swaps/rejectSwap";
import { acceptQueueSwap } from "@/server/swaps/acceptQueueSwap";
import type { SwapRequestRow } from "@/types/swaps";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateKeyToDDMMYYYY } from "@/lib/formatDate";
import { MemberScheduleMiniCalendar } from "@/components/swaps/MemberScheduleMiniCalendar";
import { OnCallSwapMiniCalendar } from "@/components/swaps/OnCallSwapMiniCalendar";

const STATUS_LABELS: Record<SwapRequestRow["status"], string> = {
  PENDING: "Aguardando aprovação",
  WAITING_SECOND_USER: "Aguardando aceite",
  SECOND_USER_ACCEPTED: "Aceito, aguardando admin",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};

const TYPE_LABELS: Record<SwapRequestRow["type"], string> = {
  OFF_SWAP: "Troca de folga",
  QUEUE_SWAP: "Troca de fila",
  ONCALL_SWAP: "Troca de sobreaviso",
};

type FilterTab = "pending" | "approved" | "rejected";

const PENDING_STATUSES: SwapRequestRow["status"][] = [
  "PENDING",
  "WAITING_SECOND_USER",
  "SECOND_USER_ACCEPTED",
];

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getDescription(s: SwapRequestRow): string {
  if (s.type === "OFF_SWAP" && s.originalDate && s.targetDate) {
    return `Troca da folga do dia ${formatDateKeyToDDMMYYYY(s.originalDate)} para o dia ${formatDateKeyToDDMMYYYY(s.targetDate)}.`;
  }
  if (s.type === "QUEUE_SWAP" && s.targetMemberName) {
    return `Troca de fila com ${s.targetMemberName}.`;
  }
  if (s.type === "ONCALL_SWAP" && s.targetMemberName) {
    return `Troca de sobreaviso com ${s.targetMemberName}.`;
  }
  if (s.type === "ONCALL_SWAP") return "Troca de sobreaviso.";
  return s.type === "OFF_SWAP" ? "Troca de folga." : "Troca de fila.";
}

interface AdminSwapListProps {
  sessionMemberId?: string | null;
}

export function AdminSwapList({ sessionMemberId }: AdminSwapListProps) {
  const [list, setList] = useState<SwapRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("pending");

  const load = () => {
    getSwapRequestsForAdmin().then((data) => {
      setList(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const filteredList = list.filter((s) => {
    if (filter === "pending") return PENDING_STATUSES.includes(s.status);
    if (filter === "approved") return s.status === "APPROVED";
    return s.status === "REJECTED" || s.status === "CANCELLED";
  });

  const canApprove = (s: SwapRequestRow) =>
    (s.type === "OFF_SWAP" && s.status === "PENDING") ||
    ((s.type === "QUEUE_SWAP" || s.type === "ONCALL_SWAP") && s.status === "SECOND_USER_ACCEPTED");

  const canReject = (s: SwapRequestRow) =>
    s.status !== "APPROVED" && s.status !== "REJECTED" && s.status !== "CANCELLED";

  const canAcceptAsSecondUser = (s: SwapRequestRow) =>
    (s.type === "QUEUE_SWAP" || s.type === "ONCALL_SWAP") &&
    s.status === "WAITING_SECOND_USER" &&
    s.targetMemberId === sessionMemberId;

  const handleApprove = async (id: string) => {
    setActionId(id);
    const result = await approveSwap(id);
    setActionId(null);
    if (result.success) load();
    else alert(result.error);
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    const result = await rejectSwap(id);
    setActionId(null);
    if (result.success) load();
    else alert(result.error);
  };

  const handleAccept = async (id: string) => {
    setActionId(id);
    const result = await acceptQueueSwap(id);
    setActionId(null);
    if (result.success) load();
    else alert(result.error);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Carregando…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border bg-muted/20 p-1">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            filter === "pending"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pendentes
        </button>
        <button
          type="button"
          onClick={() => setFilter("approved")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            filter === "approved"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Aprovadas
        </button>
        <button
          type="button"
          onClick={() => setFilter("rejected")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            filter === "rejected"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Rejeitadas
        </button>
      </div>

      {filteredList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filter === "pending" && "Nenhuma solicitação pendente."}
            {filter === "approved" && "Nenhuma solicitação aprovada."}
            {filter === "rejected" && "Nenhuma solicitação rejeitada."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-5 sm:space-y-6">
          {filteredList.map((s) => {
            const highlightDates: string[] = [];
            if (s.type === "OFF_SWAP" && s.originalDate) highlightDates.push(s.originalDate);
            if (s.type === "OFF_SWAP" && s.targetDate && s.targetDate !== s.originalDate) {
              highlightDates.push(s.targetDate);
            }
            const monthFromOriginal = s.originalDate
              ? (() => {
                  const [y, m] = s.originalDate!.split("-").map(Number);
                  return { year: y, month: m };
                })()
              : (() => {
                  const d = new Date(s.createdAt);
                  return { year: d.getFullYear(), month: d.getMonth() + 1 };
                })();
            const monthFromTarget =
              s.targetDate && s.targetDate !== s.originalDate
                ? (() => {
                    const [y, m] = s.targetDate!.split("-").map(Number);
                    return { year: y, month: m };
                  })()
                : null;

            return (
              <li key={s.id}>
                <Card className="overflow-hidden px-4">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 gap-0 md:grid-cols-4 md:gap-6">
                      <div className="md:col-span-1 space-y-4 rounded-lg border border-border/50 bg-muted/5 p-4 sm:p-5 md:py-5 md:pl-5 md:pr-0">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Quem solicitou
                          </p>
                          <p className="text-base font-bold text-foreground">{s.requesterName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Quando solicitou
                          </p>
                          <p className="text-sm tabular-nums text-foreground">{formatDate(new Date(s.createdAt))}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            O que solicitou
                          </p>
                          <p className="text-sm text-foreground">{getDescription(s)}</p>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                              s.status === "APPROVED"
                                ? "border-green-500/40 bg-green-500/10 text-green-700"
                                : s.status === "REJECTED" || s.status === "CANCELLED"
                                  ? "border-red-500/40 bg-red-500/10 text-red-700"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-800"
                            }`}
                          >
                            {TYPE_LABELS[s.type]} · {STATUS_LABELS[s.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {canAcceptAsSecondUser(s) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionId === s.id}
                              onClick={() => handleAccept(s.id)}
                            >
                              Aceitar
                            </Button>
                          )}
                          {canApprove(s) && (
                            <Button
                              size="sm"
                              disabled={actionId === s.id}
                              onClick={() => handleApprove(s.id)}
                            >
                              Aprovar
                            </Button>
                          )}
                          {canReject(s) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionId === s.id}
                              onClick={() => handleReject(s.id)}
                            >
                              Rejeitar
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex min-h-[320px] min-w-0 flex-col border-t bg-muted/5 p-4 sm:p-5 md:col-span-3 md:border-t-0 md:border-l md:py-5 md:pr-5 md:pl-5">
                        {s.type === "ONCALL_SWAP" && s.targetMemberId && s.targetMemberName ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-4">
                            <div className="grid grid-cols-1 min-h-0 flex-1 gap-4 sm:grid-cols-2">
                              <div className="flex min-h-0 flex-col">
                                <p className="mb-2 shrink-0 text-sm font-bold uppercase tracking-wider text-foreground">
                                  Sobreaviso {s.requesterName}
                                </p>
                                <div className="min-h-0 min-w-0 flex-1">
                                  <OnCallSwapMiniCalendar
                                    currentMemberId={s.requesterId}
                                    newMemberId={s.targetMemberId}
                                    year={monthFromOriginal.year}
                                    month={monthFromOriginal.month}
                                  />
                                </div>
                              </div>
                              <div className="flex min-h-0 flex-col">
                                <p className="mb-2 shrink-0 text-sm font-bold uppercase tracking-wider text-foreground">
                                  Sobreaviso {s.targetMemberName}
                                </p>
                                <div className="min-h-0 min-w-0 flex-1">
                                  <OnCallSwapMiniCalendar
                                    currentMemberId={s.targetMemberId}
                                    newMemberId={s.requesterId}
                                    year={monthFromOriginal.year}
                                    month={monthFromOriginal.month}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : s.type === "QUEUE_SWAP" && s.targetMemberId && s.targetMemberName ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-4">
                            <div className="grid grid-cols-1 min-h-0 flex-1 gap-4 sm:grid-cols-2">
                              <div className="flex min-h-0 flex-col">
                                <p className="mb-2 shrink-0 text-sm font-bold uppercase tracking-wider text-foreground">
                                  Escala {s.requesterName}
                                </p>
                                <div className="flex min-h-0 flex-1 gap-4">
                                  <div className="min-h-0 min-w-0 flex-1">
                                    <MemberScheduleMiniCalendar
                                      memberId={s.requesterId}
                                      year={monthFromOriginal.year}
                                      month={monthFromOriginal.month}
                                    />
                                  </div>
                                  {monthFromTarget &&
                                    (monthFromTarget.year !== monthFromOriginal.year ||
                                      monthFromTarget.month !== monthFromOriginal.month) && (
                                      <div className="min-h-0 min-w-0 flex-1">
                                        <MemberScheduleMiniCalendar
                                          memberId={s.requesterId}
                                          year={monthFromTarget.year}
                                          month={monthFromTarget.month}
                                        />
                                      </div>
                                    )}
                                </div>
                              </div>
                              <div className="flex min-h-0 flex-col">
                                <p className="mb-2 shrink-0 text-sm font-bold uppercase tracking-wider text-foreground">
                                  Escala {s.targetMemberName}
                                </p>
                                <div className="flex min-h-0 flex-1 gap-4">
                                  <div className="min-h-0 min-w-0 flex-1">
                                    <MemberScheduleMiniCalendar
                                      memberId={s.targetMemberId}
                                      year={monthFromOriginal.year}
                                      month={monthFromOriginal.month}
                                    />
                                  </div>
                                  {monthFromTarget &&
                                    (monthFromTarget.year !== monthFromOriginal.year ||
                                      monthFromTarget.month !== monthFromOriginal.month) && (
                                      <div className="min-h-0 min-w-0 flex-1">
                                        <MemberScheduleMiniCalendar
                                          memberId={s.targetMemberId}
                                          year={monthFromTarget.year}
                                          month={monthFromTarget.month}
                                        />
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="mb-3 shrink-0 text-sm font-bold uppercase tracking-wider text-foreground">
                              Escala do solicitante
                            </p>
                            <div className="flex min-h-0 flex-1 gap-6">
                              <div className="min-h-0 min-w-0 flex-1">
                                <MemberScheduleMiniCalendar
                                  memberId={s.requesterId}
                                  year={monthFromOriginal.year}
                                  month={monthFromOriginal.month}
                                  highlightDateKeys={highlightDates}
                                />
                              </div>
                              {monthFromTarget &&
                                (monthFromTarget.year !== monthFromOriginal.year ||
                                  monthFromTarget.month !== monthFromOriginal.month) && (
                                  <div className="min-h-0 min-w-0 flex-1">
                                    <MemberScheduleMiniCalendar
                                      memberId={s.requesterId}
                                      year={monthFromTarget.year}
                                      month={monthFromTarget.month}
                                      highlightDateKeys={highlightDates}
                                    />
                                  </div>
                                )}
                            </div>
                            {s.type === "QUEUE_SWAP" && (
                              <p className="mt-3 shrink-0 text-xs text-muted-foreground">
                                Troca de fila — escala de referência do mês.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

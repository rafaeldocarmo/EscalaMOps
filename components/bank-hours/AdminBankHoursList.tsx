"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { approveBankHourRequest } from "@/server/bank-hours/approveBankHourRequest";
import { rejectBankHourRequest } from "@/server/bank-hours/rejectBankHourRequest";
import { getBankHourRequestsForAdmin } from "@/server/bank-hours/getBankHourRequestsForAdmin";
import type { BankHourRequestRow, BankHourRequestStatus } from "@/types/bankHours";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateKeyToDDMMYYYY } from "@/lib/formatDate";
import { MemberScheduleMiniCalendar } from "@/components/swaps/MemberScheduleMiniCalendar";

type FilterTab = "pending" | "approved" | "rejected";

const PENDING_STATUSES: BankHourRequestStatus[] = ["PENDING"];

interface AdminBankHoursListProps {
  filter?: FilterTab;
  onFilterChange?: (filter: FilterTab) => void;
  hideFilterTabs?: boolean;
}

export function AdminBankHoursList({
  filter: filterProp,
  onFilterChange,
  hideFilterTabs = false,
}: AdminBankHoursListProps = {}) {
  const [list, setList] = useState<BankHourRequestRow[]>([]);
  const [internalFilter, setInternalFilter] = useState<FilterTab>("pending");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 5;

  const load = () => {
    setLoading(true);
    getBankHourRequestsForAdmin()
      .then(setList)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTimeout(() => load(), 0);
    const handler = () => load();
    window.addEventListener("bank-hours-updated", handler);
    return () => window.removeEventListener("bank-hours-updated", handler);
  }, []);

  const filter = filterProp ?? internalFilter;
  const setFilter = (next: FilterTab) => {
    if (onFilterChange) onFilterChange(next);
    else setInternalFilter(next);
  };

  useEffect(() => {
    setTimeout(() => setPage(1), 0);
  }, [filter]);

  const filtered = useMemo(() => {
    if (filter === "pending") return list.filter((r) => PENDING_STATUSES.includes(r.status));
    if (filter === "approved") return list.filter((r) => r.status === "APPROVED");
    return list.filter((r) => r.status === "REJECTED");
  }, [filter, list]);

  const extras = useMemo(
    () => filtered.filter((r) => r.type === "EXTRA_HOURS"),
    [filtered]
  );
  const offs = useMemo(
    () => filtered.filter((r) => r.type === "OFF_HOURS"),
    [filtered]
  );

  const pageLimit = page * PAGE_SIZE;
  const extrasShown = extras.slice(0, pageLimit);
  const offsShown = offs.slice(0, pageLimit);
  const hasMore = extrasShown.length < extras.length || offsShown.length < offs.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Carregando…</CardContent>
      </Card>
    );
  }

  const renderEmptyState = (kind: "extras" | "offs") => {
    const label = kind === "extras" ? "Horas extras" : "Folgas";
    const suffix =
      filter === "pending" ? "pendentes" : filter === "approved" ? "aprovadas" : "rejeitadas";
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma solicitação de {label} {suffix}.
        </CardContent>
      </Card>
    );
  };

  const renderCard = (r: BankHourRequestRow) => {
    const [yStr, mStr] = r.dateKey.split("-");
    const year = Number(yStr);
    const month = Number(mStr);

    const showActions = r.status === "PENDING";
    const balanceAfterUse = r.requesterBalanceHours - r.hours;

    return (
      <li key={r.id} className="rounded-xl border border-border/50 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{r.requesterName}</p>
          </div>

          <div className="space-y-2 text-right">
            <p className="text-sm">
              <span className="font-semibold">Data:</span> {formatDateKeyToDDMMYYYY(r.dateKey)}
            </p>
          </div>
        </div>

        {r.type === "OFF_HOURS" ? (
          <div className="grid grid-cols-1 gap-1 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm sm:grid-cols-3">
            <p className="text-foreground">
              <span className="font-semibold">Total de horas colaborador:</span>{" "}
              {r.requesterBalanceHours.toFixed(2)}
            </p>
            <p className="text-foreground">
              <span className="font-semibold">Total que irá usar:</span> {r.hours.toFixed(2)}
            </p>
            <p className={balanceAfterUse < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}>
              <span className="font-semibold">Quanto ficou:</span> {balanceAfterUse.toFixed(2)}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Horas:</span> {r.hours.toFixed(2)}
            </p>
          </div>
        )}

        {r.justification && r.justification.trim().length > 0 ? (
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            <span className="font-semibold text-foreground">Justificativa:</span> {r.justification}
          </div>
        ) : null}

        <div className="rounded-lg border border-border/50 bg-background/40 p-2">
          <MemberScheduleMiniCalendar
            memberId={r.requesterId}
            year={year}
            month={month}
            highlightNewDateKeys={[r.dateKey]}
            hideHighlightText
          />
        </div>

        {showActions ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="lg"
              onClick={async () => {
                const res = await approveBankHourRequest(r.id);
                if (!res.success) return toast.error(res.error);
                toast.success("Solicitação aprovada.");
                load();
                window.dispatchEvent(new CustomEvent("bank-hours-updated"));
              }}
            >
              Aprovar
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={async () => {
                const res = await rejectBankHourRequest(r.id);
                if (!res.success) return toast.error(res.error);
                toast.success("Solicitação rejeitada.");
                load();
                window.dispatchEvent(new CustomEvent("bank-hours-updated"));
              }}
            >
              Rejeitar
            </Button>
          </div>
        ) : null}
      </li>
    );
  };

  if (extras.length === 0 && offs.length === 0) {
    return (
      <div className="space-y-5">
        {!hideFilterTabs ? (
          <div className="inline-flex rounded-lg border border-border bg-muted/20 p-1">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                filter === "pending"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter("pending")}
            >
              Pendentes
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                filter === "approved"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter("approved")}
            >
              Aprovadas
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                filter === "rejected"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter("rejected")}
            >
              Rejeitadas
            </button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:pr-6">{renderEmptyState("extras")}</div>
          <div className="md:border-l md:border-border/50 md:pl-6">
            {renderEmptyState("offs")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!hideFilterTabs ? (
        <div className="inline-flex rounded-lg border border-border bg-muted/20 p-1">
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === "pending"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setFilter("pending")}
          >
            Pendentes
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === "approved"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setFilter("approved")}
          >
            Aprovadas
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === "rejected"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setFilter("rejected")}
          >
            Rejeitadas
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3 md:pr-6">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Horas Extras</h3>
          {extrasShown.length === 0 ? (
            renderEmptyState("extras")
          ) : (
            <ul className="space-y-4">{extrasShown.map(renderCard)}</ul>
          )}
        </div>

        <div className="space-y-3 md:border-l md:border-border/50 md:pl-6">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Folgas</h3>
          {offsShown.length === 0 ? (
            renderEmptyState("offs")
          ) : (
            <ul className="space-y-4">{offsShown.map(renderCard)}</ul>
          )}
        </div>
      </div>

      {hasMore ? (
        <div className="flex items-center justify-center">
          <Button size="lg" variant="outline" onClick={() => setPage((p) => p + 1)}>
            Carregar mais
          </Button>
        </div>
      ) : null}
    </div>
  );
}


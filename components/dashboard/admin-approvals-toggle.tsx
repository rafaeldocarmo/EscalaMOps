"use client";

import { useState } from "react";
import { AdminSwapList } from "@/components/swaps/AdminSwapList";
import { AdminBankHoursList } from "@/components/bank-hours/AdminBankHoursList";

type Tab = "swaps" | "bank_hours";
type FilterTab = "pending" | "approved" | "rejected";

function FilterTabs({
  value,
  onChange,
}: {
  value: FilterTab;
  onChange: (next: FilterTab) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/20 p-1">
      <button
        type="button"
        onClick={() => onChange("pending")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "pending"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Pendentes
      </button>
      <button
        type="button"
        onClick={() => onChange("approved")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "approved"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Aprovadas
      </button>
      <button
        type="button"
        onClick={() => onChange("rejected")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "rejected"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Rejeitadas
      </button>
    </div>
  );
}

export function AdminApprovalsToggle({
  sessionMemberId,
}: {
  sessionMemberId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("swaps");
  const [swapFilter, setSwapFilter] = useState<FilterTab>("pending");
  const [bankFilter, setBankFilter] = useState<FilterTab>("pending");

  const effectiveFilter = tab === "swaps" ? swapFilter : bankFilter;
  const setEffectiveFilter = (next: FilterTab) => {
    if (tab === "swaps") setSwapFilter(next);
    else setBankFilter(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border border-border bg-muted/20 p-1">
          <button
            type="button"
            onClick={() => setTab("swaps")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "swaps"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Trocas
          </button>
          <button
            type="button"
            onClick={() => setTab("bank_hours")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "bank_hours"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Banco de horas
          </button>
        </div>

        <FilterTabs value={effectiveFilter} onChange={setEffectiveFilter} />
      </div>

      <div>
        {tab === "swaps" ? (
          <AdminSwapList
            sessionMemberId={sessionMemberId}
            filter={swapFilter}
            onFilterChange={setSwapFilter}
            hideFilterTabs
          />
        ) : (
          <AdminBankHoursList
            filter={bankFilter}
            onFilterChange={setBankFilter}
            hideFilterTabs
          />
        )}
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMySwapRequests } from "@/server/swaps/getSwaps";

const PENDING_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"];

export function DashboardSwapBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    getMySwapRequests().then((list) => {
      const n = list.filter((s) => PENDING_STATUSES.includes(s.status)).length;
      setCount(n);
    });
  }, []);

  if (count === null || count === 0) return null;

  return (
    <Link
      href="/dashboard/swaps"
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-200"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
      {count} Solicitação{count !== 1 ? "ões" : ""} de troca
    </Link>
  );
}

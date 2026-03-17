"use client";

import Link from "next/link";

export function DashboardSwapBadge({ count }: { count: number | null }) {
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

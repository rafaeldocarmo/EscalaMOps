"use server";

import { prisma } from "@/lib/prisma";

function dateToKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * For bank-hour OFF_HOURS requests that were APPROVED with hours < 8,
 * returns dateKeys per memberId within the given month.
 *
 * The UI will only apply the orange highlight when schedule cell status is WORK,
 * so days that became OFF (total >= 8) won't show orange.
 */
export async function getApprovedOffHoursWithdrawnDatesForMonth(
  year: number,
  month: number
): Promise<Record<string, string[]>> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  const rows = await prisma.bankHourRequest.findMany({
    where: {
      type: "OFF_HOURS",
      status: "APPROVED",
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    select: { requesterId: true, date: true, hours: true },
  });

  const map: Record<string, Set<string>> = {};

  for (const r of rows) {
    const h = r.hours.toNumber();
    if (h >= 8) continue;

    const key = dateToKeyUTC(r.date);
    if (!map[r.requesterId]) map[r.requesterId] = new Set<string>();
    map[r.requesterId].add(key);
  }

  const out: Record<string, string[]> = {};
  for (const [memberId, set] of Object.entries(map)) {
    out[memberId] = [...set];
  }

  return out;
}


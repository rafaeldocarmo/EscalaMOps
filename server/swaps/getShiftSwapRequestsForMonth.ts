"use server";

import { prisma } from "@/lib/prisma";
import type { SwapRequestStatus, SwapType } from "@/types/swaps";

export interface ShiftSwapRequestForMonthRow {
  requesterId: string;
  originalDate: string; // dateKey: YYYY-MM-DD
  status: SwapRequestStatus;
  type: SwapType; // always SHIFT_SWAP
}

function dateToKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns SHIFT_SWAP requests whose originalDate falls within [monthStart, nextMonthStart),
 * using the same "noon UTC" convention used elsewhere in this app to avoid timezone edge cases.
 */
export async function getShiftSwapRequestsForMonth(year: number, month: number): Promise<ShiftSwapRequestForMonthRow[]> {
  const monthStartNoonUtc = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const nextMonthStartNoonUtc = new Date(Date.UTC(year, month, 1, 12, 0, 0));

  const list = await prisma.scheduleSwapRequest.findMany({
    where: {
      type: "SHIFT_SWAP",
      status: { in: ["PENDING", "APPROVED"] },
      originalDate: {
        gte: monthStartNoonUtc,
        lt: nextMonthStartNoonUtc,
      },
    },
    select: {
      requesterId: true,
      originalDate: true,
      status: true,
      type: true,
    },
  });

  return list.map((s) => ({
    requesterId: s.requesterId,
    originalDate: s.originalDate ? dateToKeyUTC(s.originalDate) : "",
    status: s.status,
    type: s.type,
  }));
}


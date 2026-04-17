"use server";

import { auth } from "@/auth";
import { getMySchedule, type MyScheduleDay } from "@/server/schedule/getMySchedule";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { getMyOnCallSchedule, type MyOnCallPeriod } from "@/server/sobreaviso/getMyOnCallSchedule";
import { getMyBankHourBalance } from "@/server/bank-hours/getMyBankHourBalance";
import { getMyBankHourPendingCount } from "@/server/bank-hours/getMyBankHourPendingCount";
import { getApprovedOffHoursWithdrawnDatesForMonth } from "@/server/bank-hours/getApprovedOffHoursWithdrawnDatesForMonth";
import type { SwapRequestRow } from "@/types/swaps";

export type MyDashboardBootstrap = {
  memberId: string;
  year: number;
  month: number;
  schedule: { days: MyScheduleDay[]; year: number; month: number } | null;
  swaps: SwapRequestRow[];
  onCallPeriods: MyOnCallPeriod[];
  bankHours: {
    balance: number;
    pendingCount: number;
  };
  withdrawnDateKeys: string[];
};

/**
 * Aggregated read for the personal dashboard.
 *
 * Collapses what used to be 5 separate server actions (schedule, swaps, on-call,
 * bank-hour balance, bank-hour pending count, and withdrawn-hours map) into a
 * single POST, parallelized on the server. The resulting snapshot is
 * time-consistent and cuts the round-trips the browser makes on page load.
 *
 * Returns null if the caller is not an authenticated member.
 */
export async function getMyDashboardBootstrap(
  year: number,
  month: number
): Promise<MyDashboardBootstrap | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const memberId = session.member.id;

  const [
    schedule,
    swaps,
    onCallPeriods,
    balance,
    pendingCount,
    withdrawnMap,
  ] = await Promise.all([
    getMySchedule(memberId, year, month),
    getMySwapRequests(),
    getMyOnCallSchedule(memberId, year, month),
    getMyBankHourBalance(),
    getMyBankHourPendingCount(),
    getApprovedOffHoursWithdrawnDatesForMonth(year, month),
  ]);

  return {
    memberId,
    year,
    month,
    schedule,
    swaps,
    onCallPeriods,
    bankHours: {
      balance,
      pendingCount,
    },
    withdrawnDateKeys: withdrawnMap[memberId] ?? [],
  };
}

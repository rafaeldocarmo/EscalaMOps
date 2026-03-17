"use server";

import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { getMyOnCallSchedule, type MyOnCallPeriod } from "@/server/sobreaviso/getMyOnCallSchedule";
import type { MyScheduleDay } from "@/server/schedule/getMySchedule";
import type { SwapRequestRow } from "@/types/swaps";

export type MyDashboardData = {
  schedule: { days: MyScheduleDay[]; year: number; month: number } | null;
  swaps: SwapRequestRow[];
  onCallPeriods: MyOnCallPeriod[];
};

export async function getMyDashboardData(
  memberId: string,
  year: number,
  month: number
): Promise<MyDashboardData> {
  const [schedule, swaps, onCallPeriods] = await Promise.all([
    getMySchedule(memberId, year, month),
    getMySwapRequests(),
    getMyOnCallSchedule(memberId, year, month),
  ]);
  return { schedule, swaps, onCallPeriods };
}


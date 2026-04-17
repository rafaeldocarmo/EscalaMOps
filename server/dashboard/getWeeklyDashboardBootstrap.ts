"use server";

import { auth } from "@/auth";
import { getWeeklySchedule } from "@/server/schedule/getWeeklySchedule";
import {
  getSobreavisoSummaryForWeek,
  type OnCallSummaryByWeekPart,
} from "@/server/sobreaviso/getSobreavisoSummaryForWeek";

type WeeklyScheduleResult = NonNullable<Awaited<ReturnType<typeof getWeeklySchedule>>>;

export type WeeklyDashboardBootstrap = {
  weekDays: WeeklyScheduleResult["weekDays"];
  rows: WeeklyScheduleResult["rows"];
  onCall: OnCallSummaryByWeekPart;
};

/**
 * Aggregated read for the "Escala Semanal" tab.
 *
 * Collapses the two separate server actions (weekly schedule + on-call
 * summary) into a single POST parallelized on the server so the tab paints
 * in one round-trip with a temporally consistent snapshot.
 *
 * Returns null if the caller is not an authenticated member or if the
 * weekly schedule could not be resolved.
 */
export async function getWeeklyDashboardBootstrap(): Promise<WeeklyDashboardBootstrap | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const [weekly, onCall] = await Promise.all([
    getWeeklySchedule(),
    getSobreavisoSummaryForWeek(),
  ]);

  if (!weekly) return null;

  return {
    weekDays: weekly.weekDays,
    rows: weekly.rows,
    onCall,
  };
}

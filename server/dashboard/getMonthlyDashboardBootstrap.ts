"use server";

import { auth } from "@/auth";
import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
import { getMonthlySchedule } from "@/server/schedule/getMonthlySchedule";
import {
  getSobreavisoScheduleForMonth,
  type SobreavisoWeek,
} from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import { getShiftSwapRequestsForMonth } from "@/server/swaps/getShiftSwapRequestsForMonth";
import { getApprovedOffHoursWithdrawnDatesForMonth } from "@/server/bank-hours/getApprovedOffHoursWithdrawnDatesForMonth";
import type { ScheduleRow, ScheduleAssignmentRow } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";

export type MonthlyDashboardBootstrap = {
  year: number;
  month: number;
  schedule: ScheduleRow | null;
  assignments: ScheduleAssignmentRow[];
  members: TeamMemberRow[];
  memberFormCatalog: MemberFormCatalog | null;
  sobreavisoWeeks: SobreavisoWeek[];
  shiftSwapPurpleByMemberId: Record<string, string[]>;
  hoursWithdrawnOrangeByMemberId: Record<string, string[]>;
};

/**
 * Aggregated read for the "Escala Mensal" tab.
 *
 * Collapses 4 separate server actions (monthly schedule, sobreaviso weeks,
 * shift-swap requests and approved off-hours withdrawn map) into a single
 * POST parallelized on the server. Also performs the list→map transformation
 * for shift-swap highlights here so the client stays lean.
 *
 * Returns null if the caller is not an authenticated member or if the
 * monthly schedule could not be resolved.
 */
export async function getMonthlyDashboardBootstrap(
  year: number,
  month: number
): Promise<MonthlyDashboardBootstrap | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const [
    monthly,
    sobreavisoWeeks,
    shiftSwapList,
    hoursWithdrawnMap,
  ] = await Promise.all([
    getMonthlySchedule(year, month),
    getSobreavisoScheduleForMonth(month, year),
    getShiftSwapRequestsForMonth(year, month),
    getApprovedOffHoursWithdrawnDatesForMonth(year, month),
  ]);

  if (!monthly) return null;

  const shiftSwapPurpleByMemberId: Record<string, string[]> = {};
  for (const r of shiftSwapList) {
    if (!shiftSwapPurpleByMemberId[r.requesterId]) {
      shiftSwapPurpleByMemberId[r.requesterId] = [];
    }
    shiftSwapPurpleByMemberId[r.requesterId].push(r.originalDate);
  }

  return {
    year,
    month,
    schedule: monthly.schedule,
    assignments: monthly.assignments,
    members: monthly.members,
    memberFormCatalog: monthly.memberFormCatalog,
    sobreavisoWeeks,
    shiftSwapPurpleByMemberId,
    hoursWithdrawnOrangeByMemberId: hoursWithdrawnMap,
  };
}

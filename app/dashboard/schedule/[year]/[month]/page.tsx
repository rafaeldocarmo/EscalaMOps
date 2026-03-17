import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSchedule } from "@/server/schedule/getSchedule";
import { getTeamMembers } from "@/server/team/getTeamMembers";
import { getSobreavisoScheduleForMonth } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import { SchedulePageClient } from "./schedule-page-client";
import type { ScheduleAssignmentRow, ScheduleRow } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function SchedulePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { year: yearParam, month: monthParam } = await params;
  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    redirect("/dashboard/schedule/2026/4");
  }

  const [scheduleData, members, sobreavisoWeeks] = await Promise.all([
    getSchedule(month, year),
    getTeamMembers({ forSchedule: true }),
    getSobreavisoScheduleForMonth(month, year),
  ]);

  const schedule: ScheduleRow = scheduleData.schedule;
  const assignments: ScheduleAssignmentRow[] = scheduleData.assignments;
  const teamMembers: TeamMemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    level: m.level,
    shift: m.shift,
    sobreaviso: m.sobreaviso,
    participatesInSchedule: m.participatesInSchedule,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));

  return (
    <SchedulePageClient
      schedule={schedule}
      assignments={assignments}
      members={teamMembers}
      sobreavisoWeeks={sobreavisoWeeks}
    />
  );
}

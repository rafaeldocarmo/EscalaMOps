import { auth } from "@/auth";
import { buildMemberFormCatalog } from "@/lib/memberFormCatalog";
import { isStaffAdmin } from "@/lib/authz";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { redirect } from "next/navigation";
import { getSchedule } from "@/server/schedule/getSchedule";
import { getSobreavisoScheduleForMonth } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import { getTeamLevelShiftCatalog } from "@/server/team/getTeamLevelShiftCatalog";
import { getTeamMembers } from "@/server/team/getTeamMembers";
import type { ScheduleAssignmentRow, ScheduleRow } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";
import { SchedulePageClient } from "./schedule-page-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function SchedulePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/");

  const { year: yearParam, month: monthParam } = await params;
  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    redirect("/dashboard/schedule/2026/4");
  }

  const teamId = (await resolveTeamIdForReadForSession(session)) ?? undefined;

  const [scheduleData, members, sobreavisoWeeks, catalogResult] = await Promise.all([
    getSchedule(month, year, teamId),
    getTeamMembers({ teamId }), // todos os membros da equipe
    getSobreavisoScheduleForMonth(month, year, teamId),
    getTeamLevelShiftCatalog(teamId),
  ]);

  const memberFormCatalog =
    catalogResult.success ? buildMemberFormCatalog(catalogResult.data) : null;

  const schedule: ScheduleRow = scheduleData.schedule;
  const assignments: ScheduleAssignmentRow[] = scheduleData.assignments;
  const teamMembers: TeamMemberRow[] = members;

  return (
    <div className="space-y-4">
      <SchedulePageClient
        key={`${schedule.id}:${teamId ?? ""}`}
        schedule={schedule}
        assignments={assignments}
        members={teamMembers}
        sobreavisoWeeks={sobreavisoWeeks}
        selectedTeamId={teamId ?? null}
        memberFormCatalog={memberFormCatalog}
      />
    </div>
  );
}

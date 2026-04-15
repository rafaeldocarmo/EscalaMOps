import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { redirect } from "next/navigation";
import { getTeamMembers } from "@/server/team/getTeamMembers";
import { getTeams } from "@/server/team/getTeams";
import { TeamPageClient } from "./team-page-client";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/");

  const teamId = (await resolveTeamIdForReadForSession(session)) ?? undefined;

  const [teams, members] = await Promise.all([
    getTeams(),
    getTeamMembers({ teamId }),
  ]);

  return (
    <TeamPageClient
      teams={teams}
      initialMembers={members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        level: m.level,
        shift: m.shift,
        sobreaviso: m.sobreaviso,
        participatesInSchedule: m.participatesInSchedule,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))}
    />
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTeamMembers } from "@/server/team/getTeamMembers";
import { TeamPageClient } from "./team-page-client";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const members = await getTeamMembers();

  return (
    <TeamPageClient
      initialMembers={members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        level: m.level,
        shift: m.shift,
        sobreaviso: m.sobreaviso,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))}
    />
  );
}

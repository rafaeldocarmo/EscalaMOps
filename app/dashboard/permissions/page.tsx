import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isFullAdmin } from "@/lib/authz";
import { getTeams } from "@/server/team/getTeams";
import { getUsersForPermissions } from "@/server/permissions/getUsersForPermissions";
import { PermissionsPageClient } from "./permissions-page-client";

export default async function PermissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isFullAdmin(session)) redirect("/dashboard");

  const [users, teams] = await Promise.all([getUsersForPermissions(), getTeams()]);

  return (
    <PermissionsPageClient
      initialUsers={users}
      teams={teams}
      currentUserId={session.user.id}
    />
  );
}

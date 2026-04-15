import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTeams } from "@/server/team/getTeams";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { isStaffAdmin } from "@/lib/authz";
import { TeamTitleDropdown } from "@/components/team/team-title-dropdown";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardUserHeader } from "@/components/dashboard/dashboard-user-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.member && !isStaffAdmin(session)) {
    redirect("/celular");
  }

  const showStaffSidebar = isStaffAdmin(session);

  const sidebar = showStaffSidebar ? (
    <>
      <div className="flex w-full min-w-0 items-center justify-between">
        <TeamHeader />
      </div>
      <SidebarNav />
    </>
  ) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto flex min-h-screen w-full">
        <DashboardShell sidebar={sidebar}>
          <DashboardUserHeader />
          <main className="flex-1 px-4 py-6 md:px-6 max-w-[1400px] mx-auto w-full">
            {children}
          </main>
        </DashboardShell>
      </div>
    </div>
  );
}

async function TeamHeader() {
  const session = await auth();
  const teams = await getTeams();
  const selectedTeamId = await resolveTeamIdForReadForSession(session);
  const readOnly = session?.user?.role === "ADMIN_TEAM";
  return (
    <TeamTitleDropdown teams={teams} selectedTeamId={selectedTeamId} readOnly={readOnly} />
  );
}

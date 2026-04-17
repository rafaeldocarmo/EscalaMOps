import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getTeamLevelShiftCatalog } from "@/server/team/getTeamLevelShiftCatalog";
import { TeamCatalogPageClient } from "@/components/team/team-catalog-page-client";

export default async function TeamCatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/");

  const result = await getTeamLevelShiftCatalog();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {result.error}
      </div>
    );
  }

  return <TeamCatalogPageClient initialData={result.data} />;
}

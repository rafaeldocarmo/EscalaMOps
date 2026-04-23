import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getScheduleRulesForTeam } from "@/server/scheduleRules/getScheduleRulesForTeam";
import { ScheduleRulesPageClient } from "@/components/schedule-rules/schedule-rules-page-client";

export default async function ScheduleRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/");

  const result = await getScheduleRulesForTeam();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {result.error}
      </div>
    );
  }

  return <ScheduleRulesPageClient initialData={result.data} />;
}

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getOnCallSettingsForTeam } from "@/server/sobreaviso/getOnCallSettingsForTeam";
import { OnCallSettingsPageClient } from "@/components/sobreaviso-settings/oncall-settings-page-client";

export default async function SobreavisoSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/");

  const result = await getOnCallSettingsForTeam();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {result.error}
      </div>
    );
  }

  return <OnCallSettingsPageClient initialData={result.data} />;
}


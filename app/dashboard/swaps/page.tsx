import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { AdminApprovalsToggle } from "@/components/dashboard/admin-approvals-toggle";

export default async function AdminSwapsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Aprovações
        </h1>
      </div>
      <AdminApprovalsToggle sessionMemberId={session.member?.id ?? null} />
    </div>
  );
}

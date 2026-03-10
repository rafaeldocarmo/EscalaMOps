import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user || !session.member) {
    redirect("/celular");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <DashboardTabs memberId={session.member.id} memberName={session.member.name} />
    </div>
  );
}

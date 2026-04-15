import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { AdminBankHoursList } from "@/components/bank-hours/AdminBankHoursList";
import { BankHoursTeamBalances } from "@/components/bank-hours/BankHoursTeamBalances";

export default async function BankHoursAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffAdmin(session)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Banco de Horas</h1>
      </div>
      <BankHoursTeamBalances />
      <AdminBankHoursList />
    </div>
  );
}


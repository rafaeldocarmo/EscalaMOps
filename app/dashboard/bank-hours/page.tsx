import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminBankHoursList } from "@/components/bank-hours/AdminBankHoursList";

export default async function BankHoursAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Banco de Horas</h1>
      </div>
      <AdminBankHoursList />
    </div>
  );
}


import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (isStaffAdmin(session) && !session.member) {
    redirect("/dashboard/team");
  }
  if (!session.member) {
    if (!isStaffAdmin(session)) {
      redirect("/celular");
    }
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Acesse o menu acima para gerenciar a equipe e a escala.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/team">Membros</Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href={`/dashboard/schedule/${new Date().getFullYear()}/${new Date().getMonth() + 1}`}
            >
              Escala
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/swaps">Aprovações</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/bank-hours">Banco de Horas</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardTabs memberId={session.member.id} memberName={session.member.name} />
    </div>
  );
}

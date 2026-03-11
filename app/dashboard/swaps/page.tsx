import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UnifiedSwapForm } from "@/components/swaps/UnifiedSwapForm";
import { SwapList } from "@/components/swaps/SwapList";
import { Button } from "@/components/ui/button";

export default async function SwapsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.member) {
    if (session.user.role === "ADMIN") {
      redirect("/admin/swaps");
    }
    redirect("/celular");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Solicitações de troca</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Voltar</Link>
          </Button>
        </div>
        {session.user.role === "ADMIN" && (
          <Button asChild variant="outline">
            <Link href="/admin/swaps">Ver todas (admin)</Link>
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-stretch">
        <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
          <UnifiedSwapForm memberId={session.member.id} />
        </div>
        <div className="lg:col-span-1 h-full min-h-0 flex flex-col">
          <SwapList memberId={session.member.id} />
        </div>
      </div>
    </div>
  );
}

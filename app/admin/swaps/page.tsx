import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminSwapList } from "@/components/swaps/AdminSwapList";
import { Button } from "@/components/ui/button";

export default async function AdminSwapsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Solicitações de troca (admin)</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
      <AdminSwapList sessionMemberId={session.member?.id ?? null} />
    </div>
  );
}

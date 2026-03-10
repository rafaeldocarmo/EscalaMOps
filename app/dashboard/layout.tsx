import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.member) {
    redirect("/celular");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {session.user.role === "ADMIN" && (
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard/team"
              className="text-sm font-medium text-foreground hover:underline"
            >
              Equipe
            </Link>
            <Link
              href={`/dashboard/schedule/${new Date().getFullYear()}/${new Date().getMonth() + 1}`}
              className="text-sm font-medium text-foreground hover:underline"
            >
              Escala
            </Link>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Início
            </Link>
          </nav>
          <span className="text-sm text-muted-foreground">
            {session.user.name ?? session.user.email}
            </span>
          </div>
        </header>
      )}
      <main className="container px-4 py-6 xl:max-w-none">
        <p className="text-muted-foreground mb-4">
          Olá, {session.member?.name ?? session.user.name ?? "usuário"}.
        </p>
        {children}
      </main>
    </div>
  );
}

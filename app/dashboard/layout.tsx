import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.member && session.user.role !== "ADMIN") {
    redirect("/celular");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {session.user.role === "ADMIN" && (
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4 mx-auto ">
          <Link
            href="/dashboard"
          >
            <span className="text-lg text-muted-foreground font-bold text-red-500">
              Escala MOPS
            </span>
          </Link>
          <DashboardNav hasMemberView={!!session.member} />
          </div>
        </header>
      )}
      <main className="container px-4 py-6 mx-auto">
        {children}
      </main>
    </div>
  );
}

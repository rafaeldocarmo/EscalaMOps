import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Analytics } from '@vercel/analytics/next';
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function Home() {
  const session = await auth();
  if (session?.user && !session.member) {
    redirect("/celular");
  }
  if (session?.user && session.member) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Escala MOPS</h1>
        {session?.user ? (
          <>
            <p className="text-muted-foreground">
              Olá, {session.user.name ?? session.user.email}
            </p>
            {session.member && (
              <p className="text-sm text-muted-foreground">
                Membro: {session.member.name} ({session.member.shift} {session.member.level})
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {session.user.role === "ADMIN" && (
                <Button asChild variant="default">
                  <Link href="/dashboard/team">Gerenciar equipe</Link>
                </Button>
              )}
              <SignOutButton />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Faça login para continuar.</p>
        )}
      </div>
      <Analytics />
    </div>
  );
}

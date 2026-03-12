import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhoneForm } from "./phone-form";
import { Button } from "@/components/ui/button";

export default async function CelularPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.member) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg border-0 shadow-lg sm:border sm:shadow-none">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold">Seu celular</CardTitle>
          <CardDescription>
            Informe seu número de celular com DDD para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhoneForm />

          {session.user.role === "ADMIN" && (
            <div className="flex flex-col gap-2 mt-4">
              <Button variant="outline" className="w-fit mx-auto cursor-pointer" asChild>
                <Link href="/dashboard/team">Ver como administrador</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

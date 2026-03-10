import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhoneForm } from "./phone-form";

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
        </CardContent>
      </Card>
    </div>
  );
}

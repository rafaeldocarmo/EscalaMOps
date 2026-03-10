import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    if (!session.member) redirect("/celular");
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold">Criar conta</CardTitle>
          <CardDescription>
            Preencha os dados abaixo para se cadastrar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
        <CardFooter className="flex justify-center border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    if (!session.member) redirect("/celular");
    redirect("/dashboard");
  }

  const { error: errorParam } = await searchParams;
  const credentialError =
    errorParam === "CredentialsSignin" || errorParam === "CallbackRouteError";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <LoginForm
        initialError={
          credentialError ? "Email ou senha incorretos. Tente novamente." : undefined
        }
      />
    </div>
  );
}

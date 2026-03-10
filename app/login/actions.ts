"use server";

import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginWithCredentials(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Preencha email e senha." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/celular",
    });
  } catch (error) {
    const err = error as { digest?: string; type?: string; message?: string };
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }
    if (err?.type === "CredentialsSignin" || err?.type === "CallbackRouteError") {
      return { error: "Email ou senha incorretos. Tente novamente." };
    }
    return { error: "Erro ao entrar. Tente novamente." };
  }

  return {};
}

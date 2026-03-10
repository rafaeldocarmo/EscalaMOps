"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  initialError,
}: {
  initialError?: string | null;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState<"credentials" | "google" | null>(null);

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading("credentials");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/celular",
        redirect: true,
      });
      if ((result as { error?: string } | undefined)?.error) {
        setError("Email ou senha incorretos. Tente novamente.");
      }
    } catch {
      setError("Email ou senha incorretos. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogleClick() {
    setError(null);
    setLoading("google");
    try {
      await signIn("google", { callbackUrl: "/celular", redirect: true });
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <Card className="w-full max-w-md border-0 shadow-lg sm:border sm:shadow-none">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Entrar
        </CardTitle>
        <CardDescription>
          Use sua conta Google ou email e senha para acessar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              required
              disabled={isLoading}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={isLoading}
              className="h-9"
            />
          </div>
          {(error ?? initialError) && (
            <p className="text-sm text-destructive" role="alert">
              {error ?? initialError}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {loading === "credentials" ? "Entrando…" : "Entrar com email e senha"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          disabled={isLoading}
          onClick={handleGoogleClick}
        >
          <svg className="mr-2 size-5" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading === "google" ? "Redirecionando…" : "Continuar com Google"}
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link
            href="/registro"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

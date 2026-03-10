"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      if (data.error && typeof data.error === "object") {
        setFieldErrors(data.error);
      } else {
        setError(data.error || "Erro ao criar conta. Tente novamente.");
      }
      return;
    }

    router.push("/login?registered=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Seu nome"
          autoComplete="name"
          required
          disabled={loading}
          aria-invalid={!!fieldErrors.name}
        />
        {fieldErrors.name?.[0] && (
          <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          required
          disabled={loading}
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email?.[0] && (
          <p className="text-sm text-destructive">{fieldErrors.email[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          required
          disabled={loading}
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password?.[0] && (
          <p className="text-sm text-destructive">{fieldErrors.password[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Repita a senha"
          autoComplete="new-password"
          required
          disabled={loading}
          aria-invalid={!!fieldErrors.confirmPassword}
        />
        {fieldErrors.confirmPassword?.[0] && (
          <p className="text-sm text-destructive">
            {fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}

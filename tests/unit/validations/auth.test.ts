import { describe, expect, it } from "vitest";
import { phoneSchema, signInSchema, signUpSchema } from "@/lib/validations/auth";

describe("signInSchema", () => {
  it("aceita email e senha válidos", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "any-password",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email vazio", () => {
    const result = signInSchema.safeParse({ email: "", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Email é obrigatório");
    }
  });

  it("rejeita email inválido", () => {
    const result = signInSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Email inválido")).toBe(true);
    }
  });

  it("rejeita senha vazia", () => {
    const result = signInSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Senha é obrigatória");
    }
  });
});

describe("signUpSchema", () => {
  const validBase = {
    name: "Maria Silva",
    email: "maria@example.com",
    password: "senha1234",
    confirmPassword: "senha1234",
  };

  it("aceita cadastro válido", () => {
    const result = signUpSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejeita nome com menos de 2 caracteres", () => {
    const result = signUpSchema.safeParse({ ...validBase, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Nome deve ter pelo menos 2 caracteres");
    }
  });

  it("rejeita senha com menos de 8 caracteres", () => {
    const result = signUpSchema.safeParse({
      ...validBase,
      password: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("8 caracteres"))).toBe(true);
    }
  });

  it("rejeita senha com mais de 32 caracteres", () => {
    const long = "a".repeat(33);
    const result = signUpSchema.safeParse({
      ...validBase,
      password: long,
      confirmPassword: long,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("32 caracteres"))).toBe(true);
    }
  });

  it("rejeita quando confirmação não coincide", () => {
    const result = signUpSchema.safeParse({
      ...validBase,
      password: "senha1234",
      confirmPassword: "outraSenha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmIssue = result.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(confirmIssue?.message).toBe("As senhas não coincidem");
    }
  });

  it("rejeita confirmação vazia", () => {
    const result = signUpSchema.safeParse({
      ...validBase,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Confirme a senha")).toBe(true);
    }
  });
});

describe("phoneSchema", () => {
  it("aceita número com DDD e 9 dígitos", () => {
    const result = phoneSchema.safeParse({ phone: "11987654321" });
    expect(result.success).toBe(true);
  });

  it("aceita formato com +, espaços e parênteses dentro do limite de 15 caracteres", () => {
    const result = phoneSchema.safeParse({ phone: "(11) 98765-432" });
    expect(result.success).toBe(true);
  });

  it("rejeita número curto demais", () => {
    const result = phoneSchema.safeParse({ phone: "123456789" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Informe um número válido com DDD");
    }
  });

  it("rejeita número acima do máximo permitido", () => {
    const result = phoneSchema.safeParse({ phone: "0123456789012345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Número muito longo")).toBe(true);
    }
  });

  it("rejeita caracteres fora do padrão permitido", () => {
    const result = phoneSchema.safeParse({ phone: "11-98765-abcd" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "Use apenas números, +, espaços, parênteses ou hífens"),
      ).toBe(true);
    }
  });
});

import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
  password: z
    .string()
    .min(1, "Senha é obrigatória"),
});

export const signUpSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z
      .string()
      .min(1, "Email é obrigatório")
      .email("Email inválido"),
    password: z
      .string()
      .min(8, "Senha deve ter pelo menos 8 caracteres")
      .max(32, "Senha deve ter no máximo 32 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export const phoneSchema = z.object({
  phone: z
    .string()
    .min(10, "Informe um número válido com DDD")
    .max(15, "Número muito longo")
    .regex(/^\+?[\d\s()-]+$/, "Use apenas números, +, espaços, parênteses ou hífens"),
});

type SignInInput = z.infer<typeof signInSchema>;
type SignUpInput = z.infer<typeof signUpSchema>;
type PhoneInput = z.infer<typeof phoneSchema>;

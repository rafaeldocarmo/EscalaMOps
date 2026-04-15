"use server";

import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTeamSchema = z.object({
  id: z.string().min(1, "Equipe inválida."),
  name: z.string().min(1, "Nome é obrigatório").max(120),
});

export type UpdateTeamResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateTeam(input: { id: string; name: string }): Promise<UpdateTeamResult> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem editar equipes." };
  }

  const parsed = updateTeamSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(". "),
      fieldErrors,
    };
  }

  const exists = await prisma.team.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
  if (!exists) {
    return { success: false, error: "Equipe não encontrada." };
  }

  try {
    await prisma.team.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name.trim() },
    });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("duplicate")) {
      return { success: false, error: "Já existe uma equipe com esse nome." };
    }
    return { success: false, error: "Erro ao atualizar equipe. Tente novamente." };
  }
}

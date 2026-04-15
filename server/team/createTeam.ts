"use server";

import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(120),
});

export type CreateTeamResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createTeam(input: { name: string }): Promise<CreateTeamResult> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem criar equipes." };
  }

  const parsed = createTeamSchema.safeParse(input);
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

  try {
    const existingCount = await prisma.team.count();
    const team = await prisma.team.create({
      data: {
        name: parsed.data.name.trim(),
        isDefault: existingCount === 0,
      },
      select: { id: true },
    });
    return { success: true, data: { id: team.id } };
  } catch (e) {
    // Most common: unique(name)
    const message = e instanceof Error ? e.message : "Erro ao criar equipe.";
    if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("duplicate")) {
      return { success: false, error: "Já existe uma equipe com esse nome." };
    }
    return { success: false, error: "Erro ao criar equipe. Tente novamente." };
  }
}


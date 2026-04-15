"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN", "ADMIN_TEAM"]),
  managedTeamId: z.string().nullable().optional(),
});

export type UpdateUserRoleResult = { success: true } | { success: false; error: string };

export async function updateUserRole(input: z.infer<typeof schema>): Promise<UpdateUserRoleResult> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    return { success: false, error: "Apenas administradores podem alterar permissões." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos." };
  }

  const { userId, role, managedTeamId } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  });
  if (!target) {
    return { success: false, error: "Usuário não encontrado." };
  }
  if (target.isGlobalAdmin) {
    return {
      success: false,
      error:
        "Este usuário é o administrador global (definido no banco de dados) e não pode ser alterado aqui.",
    };
  }

  if (role === "ADMIN_TEAM") {
    const tid = managedTeamId?.trim();
    if (!tid) {
      return {
        success: false,
        error: "Selecione a equipe para o perfil de administrador de equipe.",
      };
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        managedTeamId: role === "ADMIN_TEAM" ? managedTeamId!.trim() : null,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Não foi possível salvar." };
  }
}

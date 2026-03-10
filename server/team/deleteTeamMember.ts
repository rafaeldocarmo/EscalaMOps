"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type DeleteTeamMemberResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteTeamMember(id: string): Promise<DeleteTeamMemberResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado. Apenas administradores podem remover membros." };
  }

  try {
    await prisma.teamMember.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: "Erro ao remover membro. Tente novamente.",
    };
  }
}

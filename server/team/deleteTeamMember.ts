"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanEditMember } from "@/server/team/assertStaffMemberAccess";

type DeleteTeamMemberResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteTeamMember(id: string): Promise<DeleteTeamMemberResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem remover membros." };
  }

  try {
    await assertStaffCanEditMember(session, id);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
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

"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type DeleteTeamLevelResult = { success: true } | { success: false; error: string };

export async function deleteTeamLevel(id: string): Promise<DeleteTeamLevelResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const existing = await prisma.teamLevel.findUnique({
    where: { id },
    select: { teamId: true },
  });
  if (!existing) {
    return { success: false, error: "Nível não encontrado." };
  }

  try {
    assertStaffCanManageTeam(session, existing.teamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await prisma.teamLevel.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Não foi possível remover o nível." };
  }
}

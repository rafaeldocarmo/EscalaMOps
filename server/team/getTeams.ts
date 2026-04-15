"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export type TeamListItem = { id: string; name: string; isDefault: boolean };

/** Teams visible in the team switcher: todas para ADMIN; só a equipe atribuída para ADMIN_TEAM. */
export async function getTeams(): Promise<TeamListItem[]> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    throw new Error("Acesso negado. Apenas administradores podem listar equipes.");
  }

  if (session!.user!.role === "ADMIN_TEAM") {
    const id = session!.user!.managedTeamId;
    if (!id) return [];
    const t = await prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, isDefault: true },
    });
    return t ? [t] : [];
  }

  const teams = await prisma.team.findMany({
    select: { id: true, name: true, isDefault: true },
    orderBy: { name: "asc" },
  });
  return teams;
}


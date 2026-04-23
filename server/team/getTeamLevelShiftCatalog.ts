"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type TeamCatalogLevelRow = {
  id: string;
  label: string;
  color: string;
  sortOrder: number;
};

export type TeamCatalogShiftRow = {
  id: string;
  label: string;
  color: string;
  sortOrder: number;
};

export type TeamLevelShiftCatalogData = {
  teamId: string;
  levels: TeamCatalogLevelRow[];
  shifts: TeamCatalogShiftRow[];
  allowedPairs: { teamLevelId: string; teamShiftId: string }[];
};

export type GetTeamLevelShiftCatalogResult =
  | { success: true; data: TeamLevelShiftCatalogData }
  | { success: false; error: string };

/**
 * Lista níveis, turnos e pares permitidos configurados para a equipe.
 */
export async function getTeamLevelShiftCatalog(teamId?: string | null): Promise<GetTeamLevelShiftCatalogResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem ver a configuração da equipe." };
  }

  const resolvedTeamId = await resolveTeamIdForReadForSession(session, teamId);
  if (!resolvedTeamId) {
    return { success: false, error: "Nenhuma equipe encontrada para o contexto atual." };
  }

  try {
    assertStaffCanManageTeam(session, resolvedTeamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const [levels, shifts, allowedPairs] = await Promise.all([
    prisma.teamLevel.findMany({
      where: { teamId: resolvedTeamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, color: true, sortOrder: true },
    }),
    prisma.teamShift.findMany({
      where: { teamId: resolvedTeamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, color: true, sortOrder: true },
    }),
    prisma.teamLevelAllowedShift.findMany({
      where: { teamLevel: { teamId: resolvedTeamId } },
      select: { teamLevelId: true, teamShiftId: true },
    }),
  ]);

  return {
    success: true,
    data: {
      teamId: resolvedTeamId,
      levels,
      shifts,
      allowedPairs,
    },
  };
}

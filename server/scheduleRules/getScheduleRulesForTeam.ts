"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import type { RuleKind } from "@/lib/generated/prisma/enums";

export interface ScheduleRuleRow {
  id: string;
  kind: RuleKind;
  teamShiftId: string | null;
  teamLevelId: string | null;
  enabled: boolean;
  priority: number;
  params: unknown;
  updatedAt: Date;
}

export interface ScheduleRulesData {
  teamId: string;
  levels: { id: string; label: string; color: string; sortOrder: number }[];
  shifts: { id: string; label: string; color: string; sortOrder: number }[];
  rules: ScheduleRuleRow[];
  /**
   * Contagem de membros por par (turno, nível). Chave: `${teamShiftId}|${teamLevelId}`.
   * Usado na aba de compensação para exibir só grupos com pessoas e para dimensionar padrões.
   */
  memberCountByLevelShift: Record<string, number>;
}

export type GetScheduleRulesForTeamResult =
  | { success: true; data: ScheduleRulesData }
  | { success: false; error: string };

/**
 * Lista regras, turnos e níveis da equipe. Use na tela de configuração de
 * regras para montar a matriz (turno × nível).
 */
export async function getScheduleRulesForTeam(
  teamId?: string | null
): Promise<GetScheduleRulesForTeamResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
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

  const [rules, shifts, levels, memberGroups] = await Promise.all([
    prisma.scheduleRule.findMany({
      where: { teamId: resolvedTeamId },
      orderBy: [{ kind: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        kind: true,
        teamShiftId: true,
        teamLevelId: true,
        enabled: true,
        priority: true,
        params: true,
        updatedAt: true,
      },
    }),
    prisma.teamShift.findMany({
      where: { teamId: resolvedTeamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, color: true, sortOrder: true },
    }),
    prisma.teamLevel.findMany({
      where: { teamId: resolvedTeamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, color: true, sortOrder: true },
    }),
    prisma.teamMember.groupBy({
      by: ["teamLevelId", "teamShiftId"],
      where: { teamId: resolvedTeamId },
      _count: { _all: true },
    }),
  ]);

  const memberCountByLevelShift: Record<string, number> = {};
  for (const g of memberGroups) {
    memberCountByLevelShift[`${g.teamShiftId}|${g.teamLevelId}`] = g._count._all;
  }

  return {
    success: true,
    data: {
      teamId: resolvedTeamId,
      levels,
      shifts,
      rules,
      memberCountByLevelShift,
    },
  };
}

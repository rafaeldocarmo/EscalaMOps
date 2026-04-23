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
  levels: { id: string; label: string; legacyKind: string | null; sortOrder: number }[];
  shifts: { id: string; label: string; legacyKind: string | null; sortOrder: number }[];
  rules: ScheduleRuleRow[];
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

  const [rules, shifts, levels] = await Promise.all([
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
      select: { id: true, label: true, legacyKind: true, sortOrder: true },
    }),
    prisma.teamLevel.findMany({
      where: { teamId: resolvedTeamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, legacyKind: true, sortOrder: true },
    }),
  ]);

  return {
    success: true,
    data: {
      teamId: resolvedTeamId,
      levels,
      shifts,
      rules,
    },
  };
}

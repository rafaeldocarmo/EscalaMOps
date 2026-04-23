"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import { seedDefaultScheduleRulesForTeam } from "@/server/schedule/seedDefaultScheduleRules";

export type ResetScheduleRulesToDefaultsResult =
  | { success: true; data: { createdWeekendCoverage: number; createdCompensation: number } }
  | { success: false; error: string };

/**
 * Recria as regras default para os pares (turno × nível) legados que ainda
 * não tenham regra configurada. Operação idempotente: não sobrescreve o que
 * o admin já ajustou manualmente.
 */
export async function resetScheduleRulesToDefaults(input?: {
  teamId?: string | null;
}): Promise<ResetScheduleRulesToDefaultsResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  let teamId: string;
  try {
    teamId = await resolveTeamIdForWriteForSession(session, input?.teamId ?? null);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Não foi possível determinar a equipe.",
    };
  }

  try {
    assertStaffCanManageTeam(session, teamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  try {
    const data = await seedDefaultScheduleRulesForTeam(prisma, teamId);
    return { success: true, data };
  } catch (e) {
    console.error("[resetScheduleRulesToDefaults]", e);
    return { success: false, error: "Não foi possível restaurar os padrões." };
  }
}

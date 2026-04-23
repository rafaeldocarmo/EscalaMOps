"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import { createScheduleRuleSchema } from "@/lib/validations/scheduleRule";
import type { RuleKind } from "@/lib/generated/prisma/enums";

export type UpsertScheduleRuleResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Cria ou atualiza a regra do escopo (team, shift, level, kind). Se já existir
 * regra no mesmo escopo e kind, atualiza-a (update-insert); caso contrário,
 * cria nova. A unicidade por escopo é garantida na aplicação (validada antes
 * da escrita) — assim a UI pode mandar o mesmo payload sem precisar saber se
 * é create ou update.
 */
export async function upsertScheduleRule(
  input: unknown
): Promise<UpsertScheduleRuleResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = createScheduleRuleSchema.safeParse(input);
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

  let teamId: string;
  try {
    teamId = await resolveTeamIdForWriteForSession(session, parsed.data.teamId);
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

  const { kind, params, enabled, priority } = parsed.data;
  const teamShiftId = parsed.data.teamShiftId ?? null;
  const teamLevelId = parsed.data.teamLevelId ?? null;

  // Valida que shift/level informados pertencem à equipe.
  if (teamShiftId) {
    const shift = await prisma.teamShift.findFirst({
      where: { id: teamShiftId, teamId },
      select: { id: true },
    });
    if (!shift) return { success: false, error: "Turno não pertence à equipe." };
  }
  if (teamLevelId) {
    const level = await prisma.teamLevel.findFirst({
      where: { id: teamLevelId, teamId },
      select: { id: true },
    });
    if (!level) return { success: false, error: "Nível não pertence à equipe." };
  }

  try {
    const existing = await prisma.scheduleRule.findFirst({
      where: {
        teamId,
        kind: kind as RuleKind,
        teamShiftId,
        teamLevelId,
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.scheduleRule.update({
        where: { id: existing.id },
        data: {
          params: params as object,
          ...(enabled !== undefined ? { enabled } : {}),
          ...(priority !== undefined ? { priority } : {}),
        },
        select: { id: true },
      });
      return { success: true, data: { id: updated.id } };
    }

    const created = await prisma.scheduleRule.create({
      data: {
        teamId,
        teamShiftId,
        teamLevelId,
        kind: kind as RuleKind,
        params: params as object,
        enabled: enabled ?? true,
        priority: priority ?? 100,
      },
      select: { id: true },
    });
    return { success: true, data: { id: created.id } };
  } catch (e) {
    console.error("[upsertScheduleRule]", e);
    return { success: false, error: "Não foi possível salvar a regra." };
  }
}

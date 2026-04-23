"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import {
  paramsSchemaForKind,
  updateScheduleRuleSchema,
} from "@/lib/validations/scheduleRule";

export type UpdateScheduleRuleResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Atualiza campos não-estruturais de uma regra já existente:
 * `enabled`, `priority` e `params`. Mudar `kind` ou escopo cria uma regra
 * nova via `upsertScheduleRule`.
 */
export async function updateScheduleRule(
  input: unknown
): Promise<UpdateScheduleRuleResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = updateScheduleRuleSchema.safeParse(input);
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

  const existing = await prisma.scheduleRule.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, teamId: true, kind: true },
  });
  if (!existing) return { success: false, error: "Regra não encontrada." };

  try {
    assertStaffCanManageTeam(session, existing.teamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;

  if (parsed.data.params !== undefined) {
    const schema = paramsSchemaForKind(existing.kind);
    const validated = schema.safeParse(parsed.data.params);
    if (!validated.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validated.error.issues) {
        const path = ["params", ...issue.path.map(String)].join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(". "),
        fieldErrors,
      };
    }
    data.params = validated.data as object;
  }

  if (Object.keys(data).length === 0) {
    return { success: true };
  }

  try {
    await prisma.scheduleRule.update({
      where: { id: parsed.data.id },
      data: data as Parameters<typeof prisma.scheduleRule.update>[0]["data"],
    });
    return { success: true };
  } catch (e) {
    console.error("[updateScheduleRule]", e);
    return { success: false, error: "Não foi possível atualizar a regra." };
  }
}

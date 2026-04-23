"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import { deleteScheduleRuleSchema } from "@/lib/validations/scheduleRule";

export type DeleteScheduleRuleResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteScheduleRule(
  input: unknown
): Promise<DeleteScheduleRuleResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = deleteScheduleRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Id inválido." };
  }

  const existing = await prisma.scheduleRule.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, teamId: true },
  });
  if (!existing) return { success: false, error: "Regra não encontrada." };

  try {
    assertStaffCanManageTeam(session, existing.teamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  try {
    await prisma.scheduleRule.delete({ where: { id: existing.id } });
    return { success: true };
  } catch (e) {
    console.error("[deleteScheduleRule]", e);
    return { success: false, error: "Não foi possível remover a regra." };
  }
}

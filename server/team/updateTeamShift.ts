"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { flattenErrorChain, isPrismaColumnMismatchError, isUniqueConstraintError } from "@/lib/prismaErrors";
import { updateTeamShiftSchema } from "@/lib/validations/teamCatalog";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type UpdateTeamShiftResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateTeamShift(input: unknown): Promise<UpdateTeamShiftResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = updateTeamShiftSchema.safeParse(input);
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

  const existing = await prisma.teamShift.findUnique({
    where: { id: parsed.data.id },
    select: { teamId: true },
  });
  if (!existing) {
    return { success: false, error: "Turno não encontrado." };
  }

  try {
    assertStaffCanManageTeam(session, existing.teamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const { id, ...rest } = parsed.data;
  const data: Record<string, unknown> = {};
  if (rest.label !== undefined) data.label = rest.label;
  if (rest.sortOrder !== undefined) data.sortOrder = rest.sortOrder;

  if (Object.keys(data).length === 0) {
    return { success: true };
  }

  try {
    await prisma.teamShift.update({
      where: { id },
      data: data as { label?: string; sortOrder?: number },
    });
    return { success: true };
  } catch (e) {
    if (isPrismaColumnMismatchError(e)) {
      return {
        success: false,
        error:
          "Incompatibilidade entre o Prisma e o banco (erro P2022). Pare o servidor de desenvolvimento, rode `npx prisma generate` e inicie de novo.",
      };
    }
    if (isUniqueConstraintError(e)) {
      return { success: false, error: "Já existe um turno com esse nome nesta equipe." };
    }
    const chain = flattenErrorChain(e);
    if (/P2025|Record(s)? not found|not found/i.test(chain)) {
      return { success: false, error: "Turno não encontrado." };
    }
    console.error("[updateTeamShift]", flattenErrorChain(e), e);
    return { success: false, error: "Não foi possível atualizar o turno." };
  }
}

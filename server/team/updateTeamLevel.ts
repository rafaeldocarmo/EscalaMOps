"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { flattenErrorChain, isPrismaColumnMismatchError, isUniqueConstraintError } from "@/lib/prismaErrors";
import { updateTeamLevelSchema } from "@/lib/validations/teamCatalog";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type UpdateTeamLevelResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateTeamLevel(input: unknown): Promise<UpdateTeamLevelResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = updateTeamLevelSchema.safeParse(input);
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

  const existing = await prisma.teamLevel.findUnique({
    where: { id: parsed.data.id },
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

  const { id, ...rest } = parsed.data;
  const data: Record<string, unknown> = {};
  if (rest.label !== undefined) data.label = rest.label;
  if (rest.sortOrder !== undefined) data.sortOrder = rest.sortOrder;
  // `legacyKind` está presente no input quando o admin quer alterá-lo (inclusive para null).
  if ("legacyKind" in rest) data.legacyKind = rest.legacyKind ?? null;

  if (Object.keys(data).length === 0) {
    return { success: true };
  }

  try {
    await prisma.teamLevel.update({
      where: { id },
      data: data as Parameters<typeof prisma.teamLevel.update>[0]["data"],
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
      const chain = flattenErrorChain(e);
      if (chain.includes("legacy_kind") || chain.includes("legacyKind")) {
        return {
          success: false,
          error:
            "Já existe um nível dessa equipe com esse tipo do sistema. Remova o vínculo de outro nível antes.",
        };
      }
      return { success: false, error: "Já existe um nível com esse nome nesta equipe." };
    }
    const chain = flattenErrorChain(e);
    if (/P2025|Record(s)? not found|not found/i.test(chain)) {
      return { success: false, error: "Nível não encontrado." };
    }
    console.error("[updateTeamLevel]", flattenErrorChain(e), e);
    return { success: false, error: "Não foi possível atualizar o nível." };
  }
}

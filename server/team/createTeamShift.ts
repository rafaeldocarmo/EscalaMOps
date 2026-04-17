"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import { createTeamShiftSchema } from "@/lib/validations/teamCatalog";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type CreateTeamShiftResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createTeamShift(input: unknown): Promise<CreateTeamShiftResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = createTeamShiftSchema.safeParse(input);
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

  try {
    const row = await prisma.teamShift.create({
      data: {
        teamId,
        label: parsed.data.label,
        legacyKind: parsed.data.legacyKind ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
      select: { id: true },
    });
    return { success: true, data: { id: row.id } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const isUnique = message.includes("Unique") || message.toLowerCase().includes("unique");
    if (isUnique) {
      if (message.includes("legacy_kind") || message.includes("legacyKind")) {
        return {
          success: false,
          error:
            "Já existe um turno dessa equipe associado a esse tipo do sistema. Edite o turno existente em vez de criar outro.",
        };
      }
      return { success: false, error: "Já existe um turno com esse nome nesta equipe." };
    }
    return { success: false, error: "Não foi possível criar o turno." };
  }
}

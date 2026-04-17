"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { replaceAllowedShiftsForTeamLevelSchema } from "@/lib/validations/teamCatalog";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type ReplaceAllowedShiftsForTeamLevelResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Substitui o conjunto de turnos permitidos para um nível (mesma equipe).
 * `teamShiftIds` vazio remove todos os vínculos.
 */
export async function replaceAllowedShiftsForTeamLevel(input: unknown): Promise<ReplaceAllowedShiftsForTeamLevelResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  const parsed = replaceAllowedShiftsForTeamLevelSchema.safeParse(input);
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

  const { teamLevelId, teamShiftIds: rawShiftIds } = parsed.data;
  const teamShiftIds = [...new Set(rawShiftIds)];

  const level = await prisma.teamLevel.findUnique({
    where: { id: teamLevelId },
    select: { teamId: true },
  });
  if (!level) {
    return { success: false, error: "Nível não encontrado." };
  }

  try {
    assertStaffCanManageTeam(session, level.teamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  if (teamShiftIds.length === 0) {
    await prisma.teamLevelAllowedShift.deleteMany({ where: { teamLevelId } });
    return { success: true };
  }

  const shifts = await prisma.teamShift.findMany({
    where: {
      id: { in: teamShiftIds },
      teamId: level.teamId,
    },
    select: { id: true },
  });
  if (shifts.length !== teamShiftIds.length) {
    return {
      success: false,
      error: "Um ou mais turnos não pertencem a esta equipe ou não existem.",
    };
  }

  await prisma.$transaction([
    prisma.teamLevelAllowedShift.deleteMany({ where: { teamLevelId } }),
    prisma.teamLevelAllowedShift.createMany({
      data: teamShiftIds.map((teamShiftId) => ({ teamLevelId, teamShiftId })),
    }),
  ]);

  return { success: true };
}

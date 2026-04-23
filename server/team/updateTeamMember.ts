"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assertStaffCanEditMember } from "@/server/team/assertStaffMemberAccess";
import { normalizePhone } from "@/lib/phone";
import type { UpdateTeamMemberInput } from "@/lib/validations/team";
import { updateTeamMemberSchema } from "@/lib/validations/team";
import { validateMemberLevelShiftForTeam } from "@/server/team/validateMemberLevelShiftForTeam";

export type UpdateTeamMemberResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput
): Promise<UpdateTeamMemberResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem editar membros." };
  }

  try {
    await assertStaffCanEditMember(session, id);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Acesso negado." };
  }

  const parsed = updateTeamMemberSchema.safeParse(input);
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

  const memberRow = await prisma.teamMember.findUnique({
    where: { id },
    select: { teamId: true },
  });
  if (!memberRow) {
    return { success: false, error: "Membro não encontrado." };
  }

  const combo = await validateMemberLevelShiftForTeam(
    memberRow.teamId,
    parsed.data.teamLevelId,
    parsed.data.teamShiftId,
  );
  if (!combo.ok) {
    return {
      success: false,
      error: combo.error,
      fieldErrors: { teamShiftId: [combo.error] },
    };
  }

  try {
    const normalizedPhone = normalizePhone(parsed.data.phone).trim();

    const sobreaviso = parsed.data.sobreaviso ?? false;
    const participatesInSchedule = parsed.data.participatesInSchedule ?? true;

    await prisma.teamMember.update({
      where: { id },
      data: {
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        normalizedPhone,
        teamLevelId: parsed.data.teamLevelId,
        teamShiftId: parsed.data.teamShiftId,
        sobreaviso,
        participatesInSchedule,
      },
    });
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Erro ao atualizar membro. Tente novamente.",
    };
  }
}

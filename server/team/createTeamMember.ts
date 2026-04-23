"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import type { CreateTeamMemberInput } from "@/lib/validations/team";
import { createTeamMemberSchema } from "@/lib/validations/team";
import { validateMemberLevelShiftForTeam } from "@/server/team/validateMemberLevelShiftForTeam";

export type CreateTeamMemberResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createTeamMember(
  input: CreateTeamMemberInput,
  opts?: { teamId?: string }
): Promise<CreateTeamMemberResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem adicionar membros." };
  }

  const parsed = createTeamMemberSchema.safeParse(input);
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

  try {
    const normalizedPhone = normalizePhone(parsed.data.phone).trim();
    let teamId: string;
    try {
      teamId = await resolveTeamIdForWriteForSession(session, opts?.teamId);
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Não foi possível determinar a equipe.",
      };
    }

    const exists = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!exists) {
      return { success: false, error: "Equipe não encontrada." };
    }

    const combo = await validateMemberLevelShiftForTeam(
      teamId,
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

    const sobreaviso = parsed.data.sobreaviso ?? false;
    const participatesInSchedule = parsed.data.participatesInSchedule ?? true;

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        teamLevelId: parsed.data.teamLevelId,
        teamShiftId: parsed.data.teamShiftId,
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        normalizedPhone,
        sobreaviso,
        participatesInSchedule,
      },
    });
    return { success: true, data: { id: member.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao criar membro. Tente novamente.",
    };
  }
}

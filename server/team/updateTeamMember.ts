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

/**
 * Verifica se o membro tem histórico que impede a troca para um catálogo custom
 * (escala, on-call, bank hours). Returns o primeiro motivo encontrado ou null.
 */
async function findLegacyHistoryBlocker(memberId: string): Promise<string | null> {
  const [scheduleCount, onCallCount, bankRequestCount, bankTxCount] = await Promise.all([
    prisma.scheduleAssignment.count({ where: { memberId } }),
    prisma.onCallAssignment.count({ where: { memberId } }),
    prisma.bankHourRequest.count({ where: { requesterId: memberId } }),
    prisma.bankHourTransaction.count({ where: { memberId } }),
  ]);

  if (scheduleCount > 0) return "escala";
  if (onCallCount > 0) return "on-call";
  if (bankRequestCount > 0 || bankTxCount > 0) return "banco de horas";
  return null;
}

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
    select: {
      teamId: true,
      teamLevelId: true,
      teamShiftId: true,
      teamLevel: { select: { legacyKind: true } },
      teamShift: { select: { legacyKind: true } },
    },
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

  // Se mudou para um catálogo personalizado (legacyKind=NULL) e o membro antigo tinha regra legada,
  // bloqueia se houver histórico — regras legadas não sabem tratar membros sem enum.
  const movingToCustom = combo.isCustom;
  const wasLegacy =
    memberRow.teamLevel?.legacyKind != null && memberRow.teamShift?.legacyKind != null;
  const changedCatalog =
    memberRow.teamLevelId !== parsed.data.teamLevelId ||
    memberRow.teamShiftId !== parsed.data.teamShiftId;

  if (changedCatalog && movingToCustom && wasLegacy) {
    const blocker = await findLegacyHistoryBlocker(id);
    if (blocker) {
      const msg = `Não é possível trocar para um nível/turno personalizado: o membro já tem ${blocker} registrado. Remova esses registros antes ou use um nível/turno com regra definida.`;
      return {
        success: false,
        error: msg,
        fieldErrors: { teamLevelId: [msg] },
      };
    }
  }

  try {
    const normalizedPhone = normalizePhone(parsed.data.phone).trim();

    const sobreaviso = combo.isCustom ? false : parsed.data.sobreaviso ?? false;
    const participatesInSchedule = combo.isCustom
      ? false
      : parsed.data.participatesInSchedule ?? true;

    await prisma.teamMember.update({
      where: { id },
      data: {
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        normalizedPhone,
        teamLevelId: parsed.data.teamLevelId,
        teamShiftId: parsed.data.teamShiftId,
        level: combo.legacyLevel,
        shift: combo.legacyShift,
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

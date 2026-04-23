"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import { generateMonthlySchedule } from "@/server/schedule/generateMonthlySchedule";
import type { TeamMemberRow } from "@/types/team";
import type { AssignmentStatus } from "@/types/schedule";

export interface PreviewScheduleAssignment {
  memberId: string;
  date: string;
  status: AssignmentStatus;
}

export interface PreviewScheduleData {
  teamId: string;
  year: number;
  month: number;
  members: TeamMemberRow[];
  assignments: PreviewScheduleAssignment[];
}

export type PreviewScheduleResult =
  | { success: true; data: PreviewScheduleData }
  | { success: false; error: string };

/**
 * Gera a escala do mês em memória a partir das regras atualmente salvas, sem
 * persistir nada no banco (nem assignments, nem rotationIndex). Usado pelo
 * botão "Pré-visualizar escala" na tela de regras.
 */
export async function previewScheduleWithRules(input: {
  teamId?: string;
  year: number;
  month: number;
}): Promise<PreviewScheduleResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 3000) {
    return { success: false, error: "Ano inválido." };
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return { success: false, error: "Mês inválido." };
  }

  const resolvedTeamId = await resolveTeamIdForReadForSession(session, input.teamId);
  if (!resolvedTeamId) {
    return { success: false, error: "Nenhuma equipe encontrada para o contexto atual." };
  }

  try {
    assertStaffCanManageTeam(session, resolvedTeamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const rows = await prisma.teamMember.findMany({
    where: { teamId: resolvedTeamId, participatesInSchedule: true },
    select: {
      id: true,
      name: true,
      phone: true,
      level: true,
      shift: true,
      teamLevelId: true,
      teamShiftId: true,
      teamLevel: { select: { label: true, legacyKind: true, sortOrder: true } },
      teamShift: { select: { label: true, legacyKind: true, sortOrder: true } },
      sobreaviso: true,
      participatesInSchedule: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { teamLevel: { sortOrder: "asc" } },
      { teamShift: { sortOrder: "asc" } },
      { name: "asc" },
    ],
  });

  const members: TeamMemberRow[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    level: m.level,
    shift: m.shift,
    teamLevelId: m.teamLevelId,
    teamShiftId: m.teamShiftId,
    levelLabel: m.teamLevel.label,
    shiftLabel: m.teamShift.label,
    levelLegacyKind: m.teamLevel.legacyKind,
    shiftLegacyKind: m.teamShift.legacyKind,
    isCustom: m.teamLevel.legacyKind == null || m.teamShift.legacyKind == null,
    sobreaviso: m.sobreaviso,
    participatesInSchedule: m.participatesInSchedule,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));

  const generated = await generateMonthlySchedule(
    input.month,
    input.year,
    resolvedTeamId,
    { dryRun: true }
  );

  const memberIds = new Set(members.map((m) => m.id));
  const assignments: PreviewScheduleAssignment[] = generated
    .filter((a) => memberIds.has(a.memberId))
    .map((a) => ({ memberId: a.memberId, date: a.date, status: a.status }));

  return {
    success: true,
    data: {
      teamId: resolvedTeamId,
      year: input.year,
      month: input.month,
      members,
      assignments,
    },
  };
}

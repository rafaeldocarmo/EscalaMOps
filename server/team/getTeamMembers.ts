"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import type { TeamMemberRow } from "@/types/team";

export type GetTeamMembersOptions = {
  /** Se true, retorna apenas membros que participam da rotação da escala (para exibir na escala mensal). */
  forSchedule?: boolean;
  /** Quando multi-team estiver habilitado, filtra por equipe (fallback para Default Team quando omitido). */
  teamId?: string;
};

export async function getTeamMembers(opts?: GetTeamMembersOptions): Promise<TeamMemberRow[]> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    throw new Error("Acesso negado. Apenas administradores podem listar a equipe.");
  }

  const resolvedTeamId = await resolveTeamIdForReadForSession(session, opts?.teamId);

  const rows = await prisma.teamMember.findMany({
    where: {
      ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
      ...(opts?.forSchedule === true ? { participatesInSchedule: true } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      level: true,
      shift: true,
      sobreaviso: true,
      participatesInSchedule: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
  });

  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    level: m.level as TeamMemberRow["level"],
    shift: m.shift as TeamMemberRow["shift"],
    sobreaviso: m.sobreaviso,
    participatesInSchedule: m.participatesInSchedule,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));
}

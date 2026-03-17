"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TeamMemberRow } from "@/types/team";

export type GetTeamMembersOptions = {
  /** Se true, retorna apenas membros que participam da rotação da escala (para exibir na escala mensal). */
  forSchedule?: boolean;
};

export async function getTeamMembers(opts?: GetTeamMembersOptions): Promise<TeamMemberRow[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado. Apenas administradores podem listar a equipe.");
  }

  const rows = await prisma.teamMember.findMany({
    where: opts?.forSchedule === true ? { participatesInSchedule: true } : undefined,
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

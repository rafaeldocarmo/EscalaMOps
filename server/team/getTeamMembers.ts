"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TeamMemberRow } from "@/types/team";

export async function getTeamMembers(): Promise<TeamMemberRow[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado. Apenas administradores podem listar a equipe.");
  }

  const rows = await prisma.teamMember.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      level: true,
      shift: true,
      sobreaviso: true,
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
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));
}

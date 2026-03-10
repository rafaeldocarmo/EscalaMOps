"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getTeamMembers() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado. Apenas administradores podem listar a equipe.");
  }

  return prisma.teamMember.findMany({
    orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
  });
}

"use server";

import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { selectedTeamCookieName } from "@/lib/multiTeam";
import { cookies } from "next/headers";
import { z } from "zod";

const deleteTeamSchema = z.object({
  id: z.string().min(1, "Equipe inválida."),
});

export type DeleteTeamResult = { success: true } | { success: false; error: string };

export async function deleteTeam(input: { id: string }): Promise<DeleteTeamResult> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    return { success: false, error: "Acesso negado. Apenas administradores podem remover equipes." };
  }

  const parsed = deleteTeamSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(". ") };
  }

  const id = parsed.data.id;

  const teamCount = await prisma.team.count();
  if (teamCount <= 1) {
    return { success: false, error: "Não é possível remover a única equipe cadastrada." };
  }

  const team = await prisma.team.findUnique({
    where: { id },
    select: {
      id: true,
      isDefault: true,
      _count: { select: { members: true, schedules: true } },
    },
  });

  if (!team) {
    return { success: false, error: "Equipe não encontrada." };
  }

  if (team._count.members > 0) {
    return {
      success: false,
      error: "Remova ou transfira os membros desta equipe antes de excluí-la.",
    };
  }

  if (team._count.schedules > 0) {
    return {
      success: false,
      error: "Não é possível excluir uma equipe que possui escalas cadastradas.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (team.isDefault) {
        const next = await tx.team.findFirst({
          where: { id: { not: id } },
          orderBy: { name: "asc" },
          select: { id: true },
        });
        if (next) {
          await tx.team.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
      await tx.team.delete({ where: { id } });
    });

    const store = await cookies();
    const cookieId = store.get(selectedTeamCookieName())?.value?.trim();
    if (cookieId === id) {
      (store as unknown as { set: (n: string, v: string, o: object) => void }).set(
        selectedTeamCookieName(),
        "",
        { path: "/", maxAge: 0 }
      );
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao remover equipe. Tente novamente.",
    };
  }
}

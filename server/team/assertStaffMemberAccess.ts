"use server";

import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { isFullAdmin, isStaffAdmin } from "@/lib/authz";

/** Valida edição de membro da equipe para ADMIN (qualquer equipe) ou ADMIN_TEAM (só a própria equipe). */
export async function assertStaffCanEditMember(
  session: Session | null,
  memberId: string
): Promise<void> {
  if (!isStaffAdmin(session) || !session?.user) {
    throw new Error("Acesso negado.");
  }
  if (isFullAdmin(session)) return;

  const tid = session.user.managedTeamId;
  if (session.user.role !== "ADMIN_TEAM" || !tid) {
    throw new Error("Acesso negado.");
  }

  const m = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { teamId: true },
  });
  if (m?.teamId !== tid) {
    throw new Error("Este membro não pertence à sua equipe.");
  }
}

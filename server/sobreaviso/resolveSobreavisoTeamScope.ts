"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";

/**
 * Equipe para filtrar sobreaviso na leitura:
 * - explicit teamId: resolveTeamIdForRead.
 * - sem param e usuário não-admin: teamId do membro logado.
 * - admin sem param: cookie ou equipe padrão.
 */
export async function resolveSobreavisoTeamScope(teamIdParam?: string | null): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  if (teamIdParam?.trim()) {
    return (await resolveTeamIdForReadForSession(session, teamIdParam)) ?? null;
  }

  if (session.user.role === "ADMIN_TEAM" && session.user.managedTeamId) {
    return session.user.managedTeamId;
  }

  if (session.user.role !== "ADMIN" && session.member?.id) {
    const m = await prisma.teamMember.findUnique({
      where: { id: session.member.id },
      select: { teamId: true },
    });
    if (m?.teamId) return m.teamId;
  }

  return (await resolveTeamIdForReadForSession(session, null)) ?? null;
}

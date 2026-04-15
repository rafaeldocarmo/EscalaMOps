import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { cookies } from "next/headers";

const SELECTED_TEAM_COOKIE = "mops_selected_team_id";

async function getSelectedTeamIdFromCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    const v = store.get(SELECTED_TEAM_COOKIE)?.value;
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

export function selectedTeamCookieName(): string {
  return SELECTED_TEAM_COOKIE;
}

/**
 * Equipe marcada como padrão no banco (`teams.is_default`), ou a mais antiga se nenhuma estiver marcada.
 */
export async function getDefaultTeam(): Promise<{ id: string; name: string } | null> {
  const byFlag = await prisma.team.findFirst({
    where: { isDefault: true },
    select: { id: true, name: true },
  });
  if (byFlag) return byFlag;

  const fallback = await prisma.team.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!fallback) {
    log({
      level: "warn",
      event: "multi_team.no_team_rows",
      data: {},
    });
  }
  return fallback;
}

/**
 * Resolve teamId para leituras filtradas: parâmetro explícito → cookie → equipe padrão.
 */
export async function resolveTeamIdForRead(teamId?: string | null): Promise<string | null> {
  if (teamId && teamId.trim().length > 0) return teamId.trim();
  const cookieTeamId = await getSelectedTeamIdFromCookie();
  if (cookieTeamId) return cookieTeamId;
  const def = await getDefaultTeam();
  return def?.id ?? null;
}

/**
 * Resolve teamId para escrita: parâmetro explícito → cookie → equipe padrão.
 * Falha se não houver equipe resolvível.
 */
export async function resolveTeamIdForWrite(teamId?: string | null): Promise<string> {
  if (teamId && teamId.trim().length > 0) return teamId.trim();
  const cookieTeamId = await getSelectedTeamIdFromCookie();
  if (cookieTeamId) return cookieTeamId;
  const def = await getDefaultTeam();
  if (def) return def.id;
  throw new Error(
    "Nenhuma equipe padrão encontrada. Cadastre uma equipe e marque uma como padrão (is_default)."
  );
}

/** Team id forced for ADMIN_TEAM users (ignores cookie / default). */
export function getManagedTeamIdFromSession(session: Session | null): string | null {
  if (session?.user?.role === "ADMIN_TEAM" && session.user.managedTeamId) {
    return session.user.managedTeamId;
  }
  return null;
}

export async function resolveTeamIdForReadForSession(
  session: Session | null,
  teamId?: string | null
): Promise<string | null> {
  const scoped = getManagedTeamIdFromSession(session);
  if (scoped) return scoped;
  return resolveTeamIdForRead(teamId);
}

export async function resolveTeamIdForWriteForSession(
  session: Session | null,
  teamId?: string | null
): Promise<string> {
  const scoped = getManagedTeamIdFromSession(session);
  if (scoped) return scoped;
  if (session?.user?.role === "ADMIN_TEAM") {
    throw new Error("Administrador de equipe sem equipe atribuída. Contate um administrador.");
  }
  return resolveTeamIdForWrite(teamId);
}

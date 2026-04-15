import type { Session } from "next-auth";

/** Full system administrator: all teams, settings, permissions. */
export function isFullAdmin(session: Session | null): boolean {
  return session?.user?.role === "ADMIN";
}

/**
 * Staff that may operate the dashboard for (typically) one team (ADMIN_TEAM)
 * or all teams (ADMIN).
 */
export function isStaffAdmin(session: Session | null): boolean {
  const r = session?.user?.role;
  return r === "ADMIN" || r === "ADMIN_TEAM";
}

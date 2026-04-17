import type { Session } from "next-auth";
import { isFullAdmin, isStaffAdmin } from "@/lib/authz";

/** ADMIN em qualquer equipe; ADMIN_TEAM só na equipe `managedTeamId`. */
export function assertStaffCanManageTeam(session: Session | null, teamId: string): void {
  if (!isStaffAdmin(session) || !session?.user) {
    throw new Error("Acesso negado.");
  }
  if (isFullAdmin(session)) return;

  if (session.user.role === "ADMIN_TEAM" && session.user.managedTeamId === teamId) {
    return;
  }

  throw new Error("Acesso negado.");
}

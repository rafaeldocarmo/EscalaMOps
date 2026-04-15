"use server";

import { cookies } from "next/headers";
import { selectedTeamCookieName } from "@/lib/multiTeam";
import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";

export async function setSelectedTeam(teamId: string | null): Promise<void> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    throw new Error("Acesso negado.");
  }

  const name = selectedTeamCookieName();
  const store = await cookies();

  if (!teamId || teamId.trim().length === 0) {
    // Next.js types may expose cookies() as readonly; in server actions it is mutable.
    (store as unknown as { set: Function }).set(name, "", { path: "/", maxAge: 0 });
    return;
  }

  (store as unknown as { set: Function }).set(name, teamId.trim(), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}


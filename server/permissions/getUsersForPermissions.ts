"use server";

import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export type PermissionUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  managedTeamId: string | null;
  isGlobalAdmin: boolean;
};

/** Somente contas que já são administrador ou administrador de equipe. */
export async function getUsersForPermissions(): Promise<PermissionUserRow[]> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    throw new Error("Acesso negado.");
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "ADMIN_TEAM"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      managedTeamId: true,
      isGlobalAdmin: true,
    },
    orderBy: [{ email: "asc" }],
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    managedTeamId: u.managedTeamId,
    isGlobalAdmin: u.isGlobalAdmin,
  }));
}

"use server";

import { auth } from "@/auth";
import { isFullAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export type SearchableUserRow = {
  id: string;
  name: string | null;
  email: string | null;
};

/**
 * Usuários com perfil "Usuário" que podem receber permissão de admin (busca por nome ou e-mail).
 */
export async function searchUsersForPermissionGrant(query: string): Promise<SearchableUserRow[]> {
  const session = await auth();
  if (!isFullAdmin(session)) {
    throw new Error("Acesso negado.");
  }

  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      role: "USER",
      isGlobalAdmin: false,
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    take: 20,
    orderBy: [{ email: "asc" }],
  });

  return users;
}

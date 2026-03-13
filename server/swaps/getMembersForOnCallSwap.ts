"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type MemberOption = { id: string; name: string };

/**
 * List team members eligible for on-call swap: same level, sobreaviso=true, excluding self.
 */
export async function getMembersForOnCallSwap(): Promise<MemberOption[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];

  const self = await prisma.teamMember.findUnique({
    where: { id: session.member.id },
    select: { level: true, sobreaviso: true },
  });

  if (!self || !self.sobreaviso) return [];

  const members = await prisma.teamMember.findMany({
    where: {
      id: { not: session.member.id },
      level: self.level,
      sobreaviso: true,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return members.map((m) => ({ id: m.id, name: m.name }));
}

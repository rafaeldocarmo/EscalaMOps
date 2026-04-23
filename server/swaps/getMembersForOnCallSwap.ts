"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { MemberOption } from "@/types/swaps";

/**
 * List team members eligible for on-call swap: same teamLevelId, sobreaviso=true, excluding self.
 */
export async function getMembersForOnCallSwap(): Promise<MemberOption[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];

  const self = await prisma.teamMember.findUnique({
    where: { id: session.member.id },
    select: { teamLevelId: true, sobreaviso: true },
  });

  if (!self || !self.sobreaviso) return [];

  const members = await prisma.teamMember.findMany({
    where: {
      id: { not: session.member.id },
      teamLevelId: self.teamLevelId,
      sobreaviso: true,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return members.map((m) => ({ id: m.id, name: m.name }));
}

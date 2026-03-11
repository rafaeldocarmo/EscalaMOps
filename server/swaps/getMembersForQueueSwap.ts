"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type MemberOption = { id: string; name: string };

/**
 * List team members with same level and shift as current user (for queue swap), excluding self.
 */
export async function getMembersForQueueSwap(): Promise<MemberOption[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];

  const members = await prisma.teamMember.findMany({
    where: {
      id: { not: session.member.id },
      level: session.member.level,
      shift: session.member.shift,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return members.map((m) => ({ id: m.id, name: m.name }));
}

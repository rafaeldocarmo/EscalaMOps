"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Level, Shift } from "@/lib/generated/prisma/enums";
import type { MemberOption } from "@/types/swaps";

/**
 * List team members with same level and shift as current user (for queue swap), excluding self.
 */
export async function getMembersForQueueSwap(): Promise<MemberOption[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];

  const members = await prisma.teamMember.findMany({
    where: {
      id: { not: session.member.id },
      level: session.member.level as Level,
      shift: session.member.shift as Shift,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return members.map((m) => ({ id: m.id, name: m.name }));
}

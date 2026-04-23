"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
      teamLevelId: session.member.teamLevelId,
      teamShiftId: session.member.teamShiftId,
      participatesInSchedule: true,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return members.map((m) => ({ id: m.id, name: m.name }));
}

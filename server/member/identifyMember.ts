"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

export type IdentifyMemberResult =
  | { success: true; member: { id: string; name: string; level: string; shift: string } }
  | { success: false; error: string };

/**
 * Find TeamMember by phone and return member info for session.
 * Does NOT link User to TeamMember in DB; caller must update session with the returned member.
 */
export async function identifyMemberByPhone(
  phone: string
): Promise<IdentifyMemberResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Não foi possível identificar o membro. 1" };
  }

  const normalized = normalizePhone(phone).trim();
  if (!normalized) {
    return { success: false, error: "Não foi possível identificar o membro. 2" };
  }

  const member = await prisma.teamMember.findFirst({
    where: { normalizedPhone: normalized },
    select: { id: true, name: true, level: true, shift: true },
  });

  if (!member) {
    return { success: false, error: "Não foi possível identificar o membro. 3" };
  }

  return {
    success: true,
    member: {
      id: member.id,
      name: member.name,
      level: member.level,
      shift: member.shift,
    },
  };
}

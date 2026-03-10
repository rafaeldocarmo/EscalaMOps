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
    return { success: false, error: "Não autenticado." };
  }

  const normalized = normalizePhone(phone).trim();
  if (!normalized) {
    return { success: false, error: "Telefone não encontrado na equipe." };
  }

  const members = await prisma.teamMember.findMany({
    select: { id: true, name: true, level: true, shift: true, phone: true },
  });
  const member = members.find((m) => normalizePhone(m.phone) === normalized);

  if (!member) {
    return { success: false, error: "Telefone não encontrado na equipe." };
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

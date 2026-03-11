"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";

/**
 * QUEUE SWAP: User A requests to swap queue position (rotationIndex) with User B.
 * Both must have same level and shift.
 */
export async function createQueueSwapRequest(targetMemberId: string): Promise<SwapActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login e vincule seu celular para solicitar trocas." };
  }

  const requesterId = session.member.id;
  if (requesterId === targetMemberId) {
    return { success: false, error: "Não é possível trocar com você mesmo." };
  }

  const [requester, target] = await Promise.all([
    prisma.teamMember.findUnique({ where: { id: requesterId } }),
    prisma.teamMember.findUnique({ where: { id: targetMemberId } }),
  ]);

  if (!requester || !target) {
    return { success: false, error: "Membro não encontrado." };
  }
  if (requester.level !== target.level || requester.shift !== target.shift) {
    return { success: false, error: "Só é possível trocar com alguém do mesmo nível e turno." };
  }

  const existingPending = await prisma.scheduleSwapRequest.findFirst({
    where: {
      type: "QUEUE_SWAP",
      requesterId,
      targetMemberId,
      status: { in: ["WAITING_SECOND_USER", "SECOND_USER_ACCEPTED", "PENDING"] },
    },
  });
  if (existingPending) {
    return { success: false, error: "Já existe uma solicitação de troca de fila em aberto com este membro." };
  }

  await prisma.scheduleSwapRequest.create({
    data: {
      type: "QUEUE_SWAP",
      requesterId,
      targetMemberId,
      originalDate: null,
      targetDate: null,
      status: "WAITING_SECOND_USER",
    },
  });

  return { success: true };
}

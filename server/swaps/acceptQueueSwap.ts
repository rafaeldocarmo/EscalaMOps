"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";

/**
 * User B accepts the queue swap request from User A.
 */
export async function acceptQueueSwap(swapRequestId: string): Promise<SwapActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login para aceitar." };
  }

  const swap = await prisma.scheduleSwapRequest.findUnique({
    where: { id: swapRequestId },
    include: { requester: true, targetMember: true },
  });

  if (!swap || swap.type !== "QUEUE_SWAP") {
    return { success: false, error: "Solicitação não encontrada ou não é troca de fila." };
  }
  if (swap.status !== "WAITING_SECOND_USER") {
    return { success: false, error: "Esta solicitação não está aguardando sua aceitação." };
  }
  if (swap.targetMemberId !== session.member.id) {
    return { success: false, error: "Apenas o membro indicado pode aceitar esta solicitação." };
  }

  await prisma.scheduleSwapRequest.update({
    where: { id: swapRequestId },
    data: {
      status: "SECOND_USER_ACCEPTED",
      secondUserAcceptedAt: new Date(),
    },
  });

  return { success: true };
}

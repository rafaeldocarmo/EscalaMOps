"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";

/**
 * Target member rejects a queue swap request (someone requested to swap with them).
 */
export async function rejectQueueSwapAsTarget(swapRequestId: string): Promise<SwapActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login para continuar." };
  }

  const swap = await prisma.scheduleSwapRequest.findUnique({
    where: { id: swapRequestId },
  });

  if (!swap) {
    return { success: false, error: "Solicitação não encontrada." };
  }
  if (swap.type !== "QUEUE_SWAP") {
    return { success: false, error: "Apenas trocas de fila podem ser recusadas pelo destinatário." };
  }
  if (swap.targetMemberId !== session.member.id) {
    return { success: false, error: "Você não é o destinatário desta solicitação." };
  }
  if (swap.status !== "WAITING_SECOND_USER") {
    return { success: false, error: "Esta solicitação não está aguardando sua resposta." };
  }

  await prisma.scheduleSwapRequest.update({
    where: { id: swapRequestId },
    data: { status: "REJECTED" },
  });

  return { success: true };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";

const CANCELLABLE_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"] as const;

/**
 * Requester cancels their own pending swap request.
 */
export async function cancelSwapRequest(swapRequestId: string): Promise<SwapActionResult> {
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
  if (swap.requesterId !== session.member.id) {
    return { success: false, error: "Você só pode excluir suas próprias solicitações." };
  }
  if (!CANCELLABLE_STATUSES.includes(swap.status as (typeof CANCELLABLE_STATUSES)[number])) {
    return { success: false, error: "Apenas solicitações pendentes podem ser excluídas." };
  }

  await prisma.scheduleSwapRequest.update({
    where: { id: swapRequestId },
    data: { status: "CANCELLED" },
  });

  return { success: true };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";

/**
 * Admin rejects a swap request.
 */
export async function rejectSwap(swapRequestId: string): Promise<SwapActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem rejeitar." };
  }

  const swap = await prisma.scheduleSwapRequest.findUnique({
    where: { id: swapRequestId },
  });

  if (!swap) {
    return { success: false, error: "Solicitação não encontrada." };
  }
  if (swap.status === "APPROVED" || swap.status === "REJECTED" || swap.status === "CANCELLED") {
    return { success: false, error: "Esta solicitação não pode mais ser rejeitada." };
  }

  await prisma.scheduleSwapRequest.update({
    where: { id: swapRequestId },
    data: { status: "REJECTED", adminRejectedAt: new Date() },
  });

  return { success: true };
}

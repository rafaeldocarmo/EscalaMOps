"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";
import { sendWhatsappMessage } from "@/server/whatsapp/sendWhatsappMessage";

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

  if (!swap || (swap.type !== "QUEUE_SWAP" && swap.type !== "ONCALL_SWAP")) {
    return { success: false, error: "Solicitação não encontrada ou tipo inválido." };
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

  try {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://escala-mops.vercel.app";
    const requesterName = swap.requester.name;
    const targetName = swap.targetMember?.name ?? "Membro";
    const typeLabel = swap.type === "ONCALL_SWAP" ? "sobreaviso" : "escala do final de semana";
    const message = [
      "Olá Admin,",
      "",
      `${requesterName} deseja trocar sua ${typeLabel} com ${targetName}. Os dois já aprovaram a troca.`,
      "",
      `Para aceitar ou recusar entre no link ${siteUrl}/dashboard`,
    ].join("\n");
    const adminNumber = process.env.WHAPI_ADMIN_TO;
    await sendWhatsappMessage(message, adminNumber);
  } catch (err) {
    console.error("WhatsApp send error (accept queue swap)", err);
  }

  return { success: true };
}

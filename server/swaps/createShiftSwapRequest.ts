"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";
import type { Shift } from "@/lib/generated/prisma/enums";
import { sendWhatsappMessage } from "@/server/whatsapp/sendWhatsappMessage";

function parseDate(dateKey: string): Date {
  return new Date(dateKey + "T12:00:00.000Z");
}

function formatDdMm(dateKey: string): string {
  const [, mm, dd] = dateKey.split("-");
  return `${dd}/${mm}`;
}

/**
 * SHIFT_SWAP: Solicita ao gestor a troca de turno para um dia (sem alterar escala mensal no DB).
 * A mudança é exibida na UI como "troca de turno" (roxo).
 */
export async function createShiftSwapRequest(
  dateKey: string,
  targetShift: Shift,
  justification?: string
): Promise<SwapActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login e vincule seu celular para solicitar trocas." };
  }

  const requesterId = session.member.id;
  const originalDate = parseDate(dateKey);

  const year = originalDate.getUTCFullYear();
  const month = originalDate.getUTCMonth() + 1;

  // Valida: deve ser um dia de WORK para o solicitante (ou seja, não pode ser OFF).
  const schedule = await prisma.schedule.findUnique({
    where: { year_month: { year, month } },
    select: { id: true },
  });

  if (schedule) {
    const assignment = await prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: schedule.id,
        memberId: requesterId,
        date: originalDate,
        status: "OFF",
      },
    });

    if (assignment) {
      return { success: false, error: "A troca de turno deve ser solicitada para um dia de trabalho (não folga)." };
    }
  }

  const existingPending = await prisma.scheduleSwapRequest.findFirst({
    where: {
      type: "SHIFT_SWAP",
      requesterId,
      originalDate,
      status: { in: ["PENDING"] },
    },
  });

  if (existingPending) {
    return { success: false, error: "Já existe uma solicitação de troca de turno pendente para este dia." };
  }

  await prisma.scheduleSwapRequest.create({
    data: {
      type: "SHIFT_SWAP",
      requesterId,
      targetMemberId: null,
      originalDate,
      targetDate: null,
      justification: justification?.trim() ? justification.trim() : null,
      status: "PENDING",
      // targetShift não é persistido no modelo atual; é incluído nas mensagens.
    },
  });

  try {
    const requesterName = session.member.name ?? "Membro";
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://escala-mops.vercel.app";
    const message = [
      "Olá Admin,",
      "",
      `${requesterName} deseja trocar para o turno ${targetShift} no dia ${formatDdMm(dateKey)}.`,
      ...(justification?.trim() ? ["", "Justificativa:", justification.trim()] : []),
      "",
      `Para aceitar ou recusar entre no link ${siteUrl}/dashboard`,
    ].join("\n");
    await sendWhatsappMessage(message);
  } catch (err) {
    console.error("WhatsApp send error (SHIFT_SWAP create)", err);
  }

  return { success: true };
}


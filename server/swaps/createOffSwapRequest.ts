"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";
import { sendWhatsappMessage } from "@/server/whatsapp/sendWhatsappMessage";

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00.000Z");
}

/**
 * OFF SWAP: User wants to move their OFF from originalDate to targetDate.
 * - originalDate must be OFF for the user
 * - targetDate must be WORK for the user
 * - Same-level OFF rule: we check if target date would leave same level with no OFF together (soft: warn or allow)
 */
export async function createOffSwapRequest(
  originalDateStr: string,
  targetDateStr: string,
  justification?: string
): Promise<SwapActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login e vincule seu celular para solicitar trocas." };
  }

  const memberId = session.member.id;
  const originalDate = parseDate(originalDateStr);
  const targetDate = parseDate(targetDateStr);

  if (originalDateStr === targetDateStr) {
    return { success: false, error: "As datas devem ser diferentes." };
  }

  const yearOrig = originalDate.getFullYear();
  const monthOrig = originalDate.getMonth() + 1;
  const yearTarg = targetDate.getFullYear();
  const monthTarg = targetDate.getMonth() + 1;

  const [scheduleOrig, scheduleTarg] = await Promise.all([
    prisma.schedule.findUnique({ where: { year_month: { year: yearOrig, month: monthOrig } } }),
    prisma.schedule.findUnique({ where: { year_month: { year: yearTarg, month: monthTarg } } }),
  ]);

  if (!scheduleOrig || !scheduleTarg) {
    return { success: false, error: "Escala do mês não encontrada para uma das datas." };
  }

  const [assignOrig, assignTarg] = await Promise.all([
    prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: scheduleOrig.id,
        memberId,
        date: originalDate,
        status: "OFF",
      },
    }),
    prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: scheduleTarg.id,
        memberId,
        date: targetDate,
        status: "OFF",
      },
    }),
  ]);

  if (!assignOrig) {
    return { success: false, error: "A data original não é um dia de folga para você." };
  }
  if (assignTarg) {
    return { success: false, error: "A data de destino já é folga para você." };
  }

  await prisma.scheduleSwapRequest.create({
    data: {
      type: "OFF_SWAP",
      requesterId: memberId,
      targetMemberId: null,
      originalDate,
      targetDate,
      justification: justification?.trim() ? justification.trim() : null,
      status: "PENDING",
    },
  });

  try {
    const memberName = session.member.name ?? "Membro";
    const formatDdMm = (yyyyMmDd: string) => {
      const parts = yyyyMmDd.split("-");
      return `${parts[2]}/${parts[1]}`;
    };
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://escala-mops.vercel.app";
    const message = [
      "Olá Admin,",
      "",
      `${memberName} deseja trocar seu dia de folga ${formatDdMm(originalDateStr)} para o dia ${formatDdMm(targetDateStr)}.`,
      ...(justification?.trim()
        ? ["", "Justificativa:", justification.trim()]
        : []),
      "",
      `Para aceitar ou recusar entre no link ${siteUrl}/dashboard`,
    ].join("\n");
    const adminNumber = process.env.WHAPI_ADMIN_TO;
    await sendWhatsappMessage(message, adminNumber);
  } catch (err) {
    console.error("WhatsApp send error (OFF_SWAP create)", err);
  }

  return { success: true };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SwapActionResult } from "@/types/swaps";
import type { Level, Shift } from "@/lib/generated/prisma/enums";

function parseDate(dateStr: string): Date {
  // Frame 12:00Z matches how other swap functions store dates.
  return new Date(dateStr + "T12:00:00.000Z");
}

/**
 * OFF_SWAP (com membro):
 * - Requester seleciona um dia de folga (OFF) deles (originalDate).
 * - Requester seleciona um colega do mesmo nível+turno (targetMemberId).
 * - Requester seleciona um dia de folga (OFF) do colega (targetDate).
 *
 * Ao aprovar:
 * - Requester fica de folga no targetDate
 * - Colega fica de folga no originalDate
 *
 * Requer aceite do outro membro antes do admin: status WAITING_SECOND_USER.
 */
export async function createOffSwapWithMemberRequest(
  originalDateStr: string,
  targetMemberId: string,
  targetDateStr: string,
  justification?: string
): Promise<SwapActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login e vincule seu celular para solicitar trocas." };
  }

  const requesterId = session.member.id;
  if (requesterId === targetMemberId) {
    return { success: false, error: "Não é possível trocar com você mesmo." };
  }
  if (originalDateStr === targetDateStr) {
    return { success: false, error: "As datas devem ser diferentes para efetivar a troca." };
  }

  const originalDate = parseDate(originalDateStr);
  const targetDate = parseDate(targetDateStr);

  const yearOrig = originalDate.getUTCFullYear();
  const monthOrig = originalDate.getUTCMonth() + 1;
  const yearTarg = targetDate.getUTCFullYear();
  const monthTarg = targetDate.getUTCMonth() + 1;

  const [requester, targetMember] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { id: requesterId },
      select: { level: true, shift: true, teamId: true },
    }),
    prisma.teamMember.findUnique({
      where: { id: targetMemberId },
      select: { level: true, shift: true, teamId: true },
    }),
  ]);

  if (!requester || !targetMember) {
    return { success: false, error: "Membro não encontrado." };
  }
  if (requester.level !== (targetMember.level as Level) || requester.shift !== (targetMember.shift as Shift)) {
    return { success: false, error: "Só é possível trocar com alguém do mesmo nível e turno." };
  }

  const teamId = requester.teamId ?? targetMember.teamId ?? null;
  const [scheduleOrig, scheduleTarg] = await Promise.all([
    teamId
      ? prisma.schedule.findUnique({
          where: { teamId_year_month: { teamId: teamId, year: yearOrig, month: monthOrig } },
        })
      : prisma.schedule.findFirst({ where: { year: yearOrig, month: monthOrig } }),
    teamId
      ? prisma.schedule.findUnique({
          where: { teamId_year_month: { teamId: teamId, year: yearTarg, month: monthTarg } },
        })
      : prisma.schedule.findFirst({ where: { year: yearTarg, month: monthTarg } }),
  ]);

  if (!scheduleOrig || !scheduleTarg) {
    return { success: false, error: "Escala do mês não encontrada para uma das datas." };
  }

  // Validações usando registros OFF:
  // - requester: originalDate precisa ser OFF
  // - requester: targetDate precisa ser WORK (ou seja, NÃO pode haver registro OFF)
  // - targetMember: targetDate precisa ser OFF
  // - targetMember: originalDate precisa ser WORK (ou seja, NÃO pode haver registro OFF)
  const [requesterOrigOff, requesterTargOff, targetOrigOff, targetTargOff] = await Promise.all([
    prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: scheduleOrig.id,
        memberId: requesterId,
        date: originalDate,
        status: "OFF",
      },
    }),
    prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: scheduleTarg.id,
        memberId: requesterId,
        date: targetDate,
        status: "OFF",
      },
    }),
    prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: scheduleOrig.id,
        memberId: targetMemberId,
        date: originalDate,
        status: "OFF",
      },
    }),
    prisma.scheduleAssignment.findFirst({
      where: {
        scheduleId: scheduleTarg.id,
        memberId: targetMemberId,
        date: targetDate,
        status: "OFF",
      },
    }),
  ]);

  if (!requesterOrigOff) {
    return { success: false, error: "A data original não é um dia de folga para você." };
  }
  if (requesterTargOff) {
    return { success: false, error: "A data de destino já é folga para você." };
  }
  if (targetTargOff == null) {
    return { success: false, error: "A data de destino não é folga para o colega selecionado." };
  }
  if (targetOrigOff) {
    return { success: false, error: "A data original já é folga para o colega selecionado." };
  }

  const existingPending = await prisma.scheduleSwapRequest.findFirst({
    where: {
      type: "OFF_SWAP",
      requesterId,
      targetMemberId,
      status: { in: ["WAITING_SECOND_USER", "SECOND_USER_ACCEPTED", "PENDING"] },
    },
  });
  if (existingPending) {
    return { success: false, error: "Já existe uma solicitação de troca em aberto com este membro." };
  }

  await prisma.scheduleSwapRequest.create({
    data: {
      type: "OFF_SWAP",
      requesterId,
      targetMemberId,
      originalDate,
      targetDate,
      justification: justification?.trim() ? justification.trim() : null,
      status: "WAITING_SECOND_USER",
    },
  });

  return { success: true };
}


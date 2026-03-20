"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHoursActionResult } from "@/types/bankHours";
import { offHoursSchema } from "@/lib/validations/bankHours";

function parseDate(dateKey: string): Date {
  return new Date(dateKey + "T12:00:00.000Z");
}

function isFutureDate(dateKey: string): boolean {
  const d = parseDate(dateKey);
  const now = new Date();
  const todayNoonUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  return d.getTime() > todayNoonUtc.getTime();
}

export async function createOffHoursRequest(
  dateKey: string,
  hours: number,
  justification?: string
): Promise<BankHoursActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login e vincule seu celular para solicitar banco de horas." };
  }

  const parsed = offHoursSchema.safeParse({ dateKey, hours, justification });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return { success: false, error: msg };
  }

  if (isFutureDate(dateKey)) {
    // allowed for off-hours (future date)
  } else {
    return { success: false, error: "A data da folga precisa ser no futuro." };
  }

  const memberId = session.member.id;
  const requestedDate = parseDate(dateKey);
  const year = requestedDate.getUTCFullYear();
  const month = requestedDate.getUTCMonth() + 1;
  const requestedHours = parsed.data.hours;

  // Valida: data deve ser um dia de trabalho (normalmente WORK) para o usuário
  const schedule = await prisma.schedule.findUnique({
    where: { year_month: { year, month } },
    select: { id: true },
  });
  if (!schedule) {
    return { success: false, error: "Escala do mês não encontrada. Gere/salve a escala antes." };
  }

  // Work days are implicit in this app: there are records for OFF, and WORK is "absence of OFF".
  // So we validate that the selected day is NOT OFF (instead of trying to find a WORK row).
  const offAssignment = await prisma.scheduleAssignment.findFirst({
    where: {
      scheduleId: schedule.id,
      memberId,
      date: requestedDate,
      status: "OFF",
    },
    select: { status: true },
  });

  const anyAssignment = await prisma.scheduleAssignment.findFirst({
    where: {
      scheduleId: schedule.id,
      memberId,
      date: requestedDate,
    },
    select: { status: true },
  });

  if (offAssignment) {
    return { success: false, error: "A data selecionada não é um dia de trabalho para você." };
  }

  // Regra: máximo 8h solicitadas por dia (considerando pendentes + aprovadas)
  const existingRequests = await prisma.bankHourRequest.findMany({
    where: {
      requesterId: memberId,
      type: "OFF_HOURS",
      date: requestedDate,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true, status: true, hours: true },
  });

  const existingHoursTotal = existingRequests.reduce((acc, r) => acc + r.hours.toNumber(), 0);

  // #region agent log
  fetch("http://127.0.0.1:7478/ingest/7f30235a-5aca-4c83-a9a0-a050c1b4b509", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "af02be" },
    body: JSON.stringify({
      sessionId: "af02be",
      runId: "bank_hours_off_8h_debug_1",
      hypothesisId: "HsumCheck",
      location: "server/bank-hours/createOffHoursRequest.ts:8hValidation",
      message: "8h/day validation inputs",
      data: {
        memberId,
        dateKey,
        requestedDateIso: requestedDate.toISOString(),
        requestedHours,
        existingCount: existingRequests.length,
        existingHoursTotal,
        existing: existingRequests.map((r) => ({
          id: r.id,
          status: r.status,
          hours: r.hours.toNumber(),
        })),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (existingHoursTotal + requestedHours > 8 + 1e-9) {
    const remaining = Math.max(0, 8 - existingHoursTotal);
    return {
      success: false,
      error: `Você já tem ${existingHoursTotal.toFixed(2)} horas solicitadas/aprovadas neste dia. Só pode solicitar mais ${remaining.toFixed(2)} horas (máximo 8h/dia).`,
    };
  }

  // Valida saldo suficiente (saldo atual já aprovado)
  const balanceRow = await prisma.bankHourBalance.findUnique({
    where: { memberId },
    select: { balanceHours: true },
  });
  const balanceHours = balanceRow?.balanceHours.toNumber() ?? 0;
  if (requestedHours > balanceHours) {
    return { success: false, error: "Saldo insuficiente de banco de horas." };
  }

  await prisma.bankHourRequest.create({
    data: {
      type: "OFF_HOURS",
      requesterId: memberId,
      date: requestedDate,
      hours: requestedHours,
      justification: parsed.data.justification.trim(),
      status: "PENDING",
    },
  });

  return { success: true };
}


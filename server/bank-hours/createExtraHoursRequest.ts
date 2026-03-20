"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHoursActionResult } from "@/types/bankHours";
import { extraHoursSchema } from "@/lib/validations/bankHours";

function parseDate(dateKey: string): Date {
  return new Date(dateKey + "T12:00:00.000Z");
}

function isFutureDate(dateKey: string): boolean {
  const d = parseDate(dateKey);
  const now = new Date();
  const todayNoonUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  return d.getTime() > todayNoonUtc.getTime();
}

export async function createExtraHoursRequest(
  dateKey: string,
  hours: number,
  justification: string
): Promise<BankHoursActionResult> {
  const session = await auth();
  if (!session?.user || !session.member) {
    return { success: false, error: "Faça login e vincule seu celular para solicitar banco de horas." };
  }

  const parsed = extraHoursSchema.safeParse({ dateKey, hours, justification });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return { success: false, error: msg };
  }

  if (isFutureDate(dateKey)) {
    return { success: false, error: "A data não pode estar no futuro." };
  }

  await prisma.bankHourRequest.create({
    data: {
      type: "EXTRA_HOURS",
      requesterId: session.member.id,
      date: parseDate(dateKey),
      hours: parsed.data.hours,
      justification: parsed.data.justification.trim(),
      status: "PENDING",
    },
  });

  return { success: true };
}


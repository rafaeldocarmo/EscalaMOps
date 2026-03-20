"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHoursActionResult } from "@/types/bankHours";
import { extraHoursSchema } from "@/lib/validations/bankHours";
import { sendWhatsappMessage } from "@/server/whatsapp/sendWhatsappMessage";

function parseDate(dateKey: string): Date {
  return new Date(dateKey + "T12:00:00.000Z");
}

function isFutureDate(dateKey: string): boolean {
  const d = parseDate(dateKey);
  const now = new Date();
  const todayNoonUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  return d.getTime() > todayNoonUtc.getTime();
}

function formatDateKeyToDDMM(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}/${m}`;
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

  // #region notify admin (WhatsApp)
  const requesterName = session.member.name ?? "Membro";
  const ddmm = formatDateKeyToDDMM(dateKey);
  const cleanJust = parsed.data.justification.trim();
  const message = `Olá Admin,\n\n${requesterName} deseja solicitar ${parsed.data.hours} horas extras no dia ${ddmm}.\n\nJustificativa: ${cleanJust}`;
  await sendWhatsappMessage(message).catch(() => {});
  // #endregion

  return { success: true };
}


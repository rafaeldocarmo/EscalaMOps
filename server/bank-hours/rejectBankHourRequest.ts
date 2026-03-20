"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHoursActionResult } from "@/types/bankHours";

export async function rejectBankHourRequest(requestId: string): Promise<BankHoursActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem rejeitar." };
  }

  const req = await prisma.bankHourRequest.findUnique({ where: { id: requestId }, select: { status: true } });
  if (!req) return { success: false, error: "Solicitação não encontrada." };
  if (req.status !== "PENDING") return { success: false, error: "Esta solicitação não está pendente." };

  await prisma.bankHourRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", adminRejectedAt: new Date() },
  });

  return { success: true };
}


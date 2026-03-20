"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getMyBankHourBalance(): Promise<number> {
  const session = await auth();
  if (!session?.user || !session.member) return 0;

  const row = await prisma.bankHourBalance.findUnique({
    where: { memberId: session.member.id },
    select: { balanceHours: true },
  });

  return row?.balanceHours.toNumber() ?? 0;
}


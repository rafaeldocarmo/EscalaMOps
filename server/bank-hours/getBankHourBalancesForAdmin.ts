"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHourMemberBalanceRow } from "@/types/bankHours";

export async function getBankHourBalancesForAdmin(): Promise<BankHourMemberBalanceRow[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return [];

  const members = await prisma.teamMember.findMany({
    orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
    include: {
      bankHourBalance: { select: { balanceHours: true } },
      bankHourRequests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  return members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    level: m.level,
    shift: m.shift,
    participatesInSchedule: m.participatesInSchedule,
    balanceHours: m.bankHourBalance?.balanceHours.toNumber() ?? 0,
    pendingRequests: m.bankHourRequests.length,
  }));
}


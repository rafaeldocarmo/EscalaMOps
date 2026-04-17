"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import type { BankHourMemberBalanceRow } from "@/types/bankHours";

export async function getBankHourBalancesForAdmin(): Promise<BankHourMemberBalanceRow[]> {
  const session = await auth();
  if (!session?.user || !isStaffAdmin(session)) return [];

  const teamId = await resolveTeamIdForReadForSession(session);

  const members = await prisma.teamMember.findMany({
    where: {
      ...(teamId ? { teamId } : {}),
    },
    orderBy: [
      { teamLevel: { sortOrder: "asc" } },
      { teamShift: { sortOrder: "asc" } },
      { name: "asc" },
    ],
    include: {
      bankHourBalance: { select: { balanceHours: true } },
      bankHourRequests: { where: { status: "PENDING" }, select: { id: true } },
      teamLevel: { select: { label: true } },
      teamShift: { select: { label: true } },
    },
  });

  return members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    level: m.teamLevel.label,
    shift: m.teamShift.label,
    participatesInSchedule: m.participatesInSchedule,
    balanceHours: m.bankHourBalance?.balanceHours.toNumber() ?? 0,
    pendingRequests: m.bankHourRequests.length,
  }));
}


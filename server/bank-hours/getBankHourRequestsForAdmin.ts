"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHourRequestRow, BankHourRequestStatus, BankHourRequestType } from "@/types/bankHours";

function dateToKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getBankHourRequestsForAdmin(): Promise<BankHourRequestRow[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return [];

  const list = await prisma.bankHourRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { requester: { select: { id: true, name: true } } },
  });

  return list.map((r) => ({
    id: r.id,
    type: r.type as BankHourRequestType,
    requesterId: r.requesterId,
    requesterName: r.requester.name,
    dateKey: r.date ? dateToKeyUTC(r.date) : "",
    hours: r.hours.toNumber(),
    justification: r.justification,
    status: r.status as BankHourRequestStatus,
    adminApprovedAt: r.adminApprovedAt ? r.adminApprovedAt.toISOString() : null,
    adminRejectedAt: r.adminRejectedAt ? r.adminRejectedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}


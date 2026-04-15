"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import type { SwapRequestRow } from "@/types/swaps";

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Get swap requests for the current user: as requester or as target (queue swap).
 */
export async function getMySwapRequests(): Promise<SwapRequestRow[]> {
  const session = await auth();
  if (!session?.user || !session.member) return [];

  const memberId = session.member.id;

  const list = await prisma.scheduleSwapRequest.findMany({
    where: {
      OR: [{ requesterId: memberId }, { targetMemberId: memberId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true } },
      targetMember: { select: { id: true, name: true } },
    },
  });

  return list.map((s) => ({
    id: s.id,
    type: s.type,
    requesterId: s.requesterId,
    requesterName: s.requester.name,
    targetMemberId: s.targetMemberId,
    targetMemberName: s.targetMember?.name ?? null,
    originalDate: s.originalDate ? dateToKey(s.originalDate) : null,
    targetDate: s.targetDate ? dateToKey(s.targetDate) : null,
    justification: s.justification ?? null,
    status: s.status,
    secondUserAcceptedAt: s.secondUserAcceptedAt ? s.secondUserAcceptedAt.toISOString() : null,
    adminApprovedAt: s.adminApprovedAt ? s.adminApprovedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

/**
 * Get all swap requests (admin).
 */
export async function getSwapRequestsForAdmin(): Promise<SwapRequestRow[]> {
  const session = await auth();
  if (!isStaffAdmin(session)) return [];

  const teamId = await resolveTeamIdForReadForSession(session);

  const list = await prisma.scheduleSwapRequest.findMany({
    where: {
      ...(teamId ? { requester: { teamId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true } },
      targetMember: { select: { id: true, name: true } },
    },
  });

  return list.map((s) => ({
    id: s.id,
    type: s.type,
    requesterId: s.requesterId,
    requesterName: s.requester.name,
    targetMemberId: s.targetMemberId,
    targetMemberName: s.targetMember?.name ?? null,
    originalDate: s.originalDate ? dateToKey(s.originalDate) : null,
    targetDate: s.targetDate ? dateToKey(s.targetDate) : null,
    justification: s.justification ?? null,
    status: s.status,
    secondUserAcceptedAt: s.secondUserAcceptedAt ? s.secondUserAcceptedAt.toISOString() : null,
    adminApprovedAt: s.adminApprovedAt ? s.adminApprovedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

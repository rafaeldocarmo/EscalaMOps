"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Count of all pending bank-hour requests (both EXTRA_HOURS and OFF_HOURS)
 * for the logged-in member.
 */
export async function getMyBankHourPendingCount(): Promise<number> {
  const session = await auth();
  if (!session?.user || !session.member) return 0;

  const count = await prisma.bankHourRequest.count({
    where: {
      requesterId: session.member.id,
      status: "PENDING",
    },
  });

  return count;
}


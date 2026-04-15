import { prisma } from "@/lib/prisma";
import { getDefaultTeam } from "@/lib/multiTeam";

/** Prisma client or transaction client (same delegate shape). */
type Db = {
  schedule: (typeof prisma)["schedule"];
};

/**
 * Find schedule for (year, month) scoped to a team when teamId is known.
 * Falls back to first match by (year, month) only when teamId is missing (legacy).
 */
export async function findScheduleByYearMonth(
  db: Db,
  year: number,
  month: number,
  teamId: string | null
) {
  if (teamId) {
    return db.schedule.findUnique({
      where: { teamId_year_month: { teamId, year, month } },
    });
  }
  return db.schedule.findFirst({
    where: { year, month },
  });
}

/** Resolve team id for schedule lookups from a member row (falls back to default team). */
export async function teamIdForMemberOrDefault(memberTeamId: string | null): Promise<string | null> {
  if (memberTeamId) return memberTeamId;
  const def = await getDefaultTeam();
  return def?.id ?? null;
}

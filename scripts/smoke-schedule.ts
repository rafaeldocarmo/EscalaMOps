/**
 * Smoke checks for production-like environments.
 *
 * Runs a few read-only queries to validate basic invariants:
 * - schedules uniqueness by (team_id, year, month)
 * - no missing schedules for given (year, month) when expected
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/smoke-schedule.ts 2026 4
 */

import { prisma } from "@/lib/prisma";

async function main() {
  const [yearStr, monthStr] = process.argv.slice(2);
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    console.error("Usage: npx tsx scripts/smoke-schedule.ts <year> <month>");
    process.exit(2);
  }

  const duplicates = await prisma.schedule.groupBy({
    by: ["teamId", "year", "month"],
    _count: { _all: true },
    having: { id: { _count: { gt: 1 } } },
  });

  const schedule = await prisma.schedule.findFirst({
    where: { year, month },
    select: { id: true, teamId: true, status: true, createdAt: true, updatedAt: true },
  });

  const membersCount = await prisma.teamMember.count({
    where: { participatesInSchedule: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: duplicates.length === 0,
        duplicates,
        target: { year, month, scheduleExists: Boolean(schedule), schedule },
        participatesInScheduleMembers: membersCount,
      },
      null,
      2
    )
  );

  if (duplicates.length > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


/**
 * Cria (idempotente) a equipe legada por nome, marca como padrão (is_default),
 * e preenche team_id em membros/schedules onde for NULL.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/backfill-default-team.ts
 *
 * Opcional:
 *   DEFAULT_TEAM_NAME="Equipe Principal"
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";

const DEFAULT_TEAM_NAME = process.env.DEFAULT_TEAM_NAME?.trim() || "Equipe Principal";

async function main() {
  const startedAt = Date.now();

  const team = await prisma.$transaction(async (tx) => {
    await tx.team.updateMany({ data: { isDefault: false } });
    return tx.team.upsert({
      where: { name: DEFAULT_TEAM_NAME },
      create: { name: DEFAULT_TEAM_NAME, isDefault: true },
      update: { isDefault: true },
      select: { id: true, name: true },
    });
  });

  const membersRes = await prisma.teamMember.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });

  const schedulesRes = await prisma.$executeRaw`
    UPDATE schedules SET team_id = ${team.id} WHERE team_id IS NULL
  `;

  const stillNullMembers = await prisma.teamMember.count({ where: { teamId: null } });
  const stillNullSchedulesRows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count FROM schedules WHERE team_id IS NULL
  `;
  const stillNullSchedules = Number(stillNullSchedulesRows[0].count);

  console.log(
    JSON.stringify(
      {
        ok: stillNullMembers === 0 && stillNullSchedules === 0,
        defaultTeam: team,
        updated: {
          teamMembers: membersRes.count,
          schedules: Number(schedulesRes),
        },
        remainingNull: {
          teamMembers: stillNullMembers,
          schedules: stillNullSchedules,
        },
        elapsedMs: Date.now() - startedAt,
      },
      null,
      2
    )
  );

  if (stillNullMembers !== 0 || stillNullSchedules !== 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

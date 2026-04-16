import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Level, Shift } from "@/lib/generated/prisma/enums";
import { cleanupTeamCascade, createEmptyTeam, uniqueTeamName } from "@/tests/helpers/team-crud-context";

function mkPhones(slot: number) {
  const tail = `${randomBytes(3).toString("hex")}${slot}`.replace(/\D/g, "").slice(0, 8).padStart(8, "0");
  return { phone: `11${tail}`, normalizedPhone: `5511${tail}` };
}

/** Três membros elegíveis para geração de sobreaviso (N2, ESPC, PRODUCAO), com `sobreaviso: true`. */
export async function createSobreavisoEligibleMembers(teamId: string) {
  const mN2 = await prisma.teamMember.create({
    data: {
      teamId,
      name: "Sobre N2",
      ...mkPhones(1),
      level: Level.N2,
      shift: Shift.T1,
      sobreaviso: true,
      onCallRotationIndex: 0,
    },
  });
  const mEspc = await prisma.teamMember.create({
    data: {
      teamId,
      name: "Sobre ESPC",
      ...mkPhones(2),
      level: Level.ESPC,
      shift: Shift.TC,
      sobreaviso: true,
      onCallRotationIndex: 0,
    },
  });
  const mProd = await prisma.teamMember.create({
    data: {
      teamId,
      name: "Sobre PROD",
      ...mkPhones(3),
      level: Level.PRODUCAO,
      shift: Shift.TC,
      sobreaviso: true,
      onCallRotationIndex: 0,
    },
  });
  return { mN2, mEspc, mProd };
}

export async function createTeamWithSobreavisoMembers() {
  const team = await createEmptyTeam(uniqueTeamName("mops-sa"));
  const members = await createSobreavisoEligibleMembers(team.id);
  return { team, ...members };
}

/** Remove assignments de plantão e depois a equipe (membros, escalas). */
export async function cleanupTeamAndOnCallAssignments(teamId: string): Promise<void> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { id: true },
  });
  const ids = members.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.onCallAssignment.deleteMany({ where: { memberId: { in: ids } } });
  }
  await cleanupTeamCascade(teamId);
}

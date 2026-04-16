import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Level, ScheduleStatus, Shift } from "@/lib/generated/prisma/enums";

export function uniqueTeamName(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

export async function createEmptyTeam(name: string) {
  return prisma.team.create({
    data: { name, isDefault: false },
  });
}

export async function createTestTeamMember(teamId: string) {
  const tail = randomBytes(3).toString("hex");
  return prisma.teamMember.create({
    data: {
      teamId,
      name: "Membro CRUD teste",
      phone: `11988${tail}`,
      normalizedPhone: `5511988${tail}`,
      level: Level.N1,
      shift: Shift.T1,
    },
  });
}

export async function createTestSchedule(teamId: string, year: number, month: number) {
  return prisma.schedule.create({
    data: {
      teamId,
      year,
      month,
      status: ScheduleStatus.OPEN,
    },
  });
}

/** Remove equipe de teste (membros, atribuições de escala, escalas). */
export async function cleanupTeamCascade(teamId: string): Promise<void> {
  const schedules = await prisma.schedule.findMany({
    where: { teamId },
    select: { id: true },
  });
  for (const s of schedules) {
    await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: s.id } });
  }
  await prisma.schedule.deleteMany({ where: { teamId } });
  await prisma.teamMember.deleteMany({ where: { teamId } });
  await prisma.team.deleteMany({ where: { id: teamId } });
}

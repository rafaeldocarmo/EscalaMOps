import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  AssignmentStatus,
  BankHourRequestStatus,
  BankHourRequestType,
  Level,
  ScheduleStatus,
  Shift,
} from "@/lib/generated/prisma/enums";
import { ensureLegacyCatalogForTeam } from "@/tests/helpers/team-crud-context";

/** Mesma regra de data que `createOffHoursRequest` (meio-dia UTC). */
export function parseDateKeyUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export type OffHoursRequestTestContext = {
  teamId: string;
  memberId: string;
  scheduleId: string;
  dateKey: string;
  workDateUtc: Date;
};

const DEFAULT_DATE_KEY = "2099-06-20";

/**
 * Cria equipe, membro, escala do mês e saldo de banco de horas para testes de `createOffHoursRequest`.
 * Não cria assignment na data de trabalho (dia tratado como WORK implícito).
 */
export async function createOffHoursRequestTestContext(
  options: {
    dateKey?: string;
    balanceHours?: number;
  } = {},
): Promise<OffHoursRequestTestContext> {
  const dateKey = options.dateKey ?? DEFAULT_DATE_KEY;
  const workDateUtc = parseDateKeyUtc(dateKey);
  const year = workDateUtc.getUTCFullYear();
  const month = workDateUtc.getUTCMonth() + 1;
  const suffix = randomBytes(4).toString("hex");

  const team = await prisma.team.create({
    data: {
      name: `mops-bh-${suffix}`,
      isDefault: false,
    },
  });

  const { levelIds, shiftIds } = await ensureLegacyCatalogForTeam(team.id);

  const member = await prisma.teamMember.create({
    data: {
      teamId: team.id,
      teamLevelId: levelIds[Level.N1],
      teamShiftId: shiftIds[Shift.T1],
      name: "Membro BH Teste",
      phone: `11999${suffix.slice(0, 5)}`,
      normalizedPhone: `5511999${suffix.slice(0, 5)}`,
      level: Level.N1,
      shift: Shift.T1,
    },
  });

  await prisma.bankHourBalance.create({
    data: {
      memberId: member.id,
      balanceHours: options.balanceHours ?? 40,
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      teamId: team.id,
      year,
      month,
      status: ScheduleStatus.OPEN,
    },
  });

  return {
    teamId: team.id,
    memberId: member.id,
    scheduleId: schedule.id,
    dateKey,
    workDateUtc,
  };
}

/** Remove dados criados por `createOffHoursRequestTestContext` (ordem respeitando FKs). */
export async function destroyOffHoursRequestTestContext(ctx: OffHoursRequestTestContext): Promise<void> {
  await prisma.bankHourRequest.deleteMany({ where: { requesterId: ctx.memberId } });
  await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: ctx.scheduleId } });
  await prisma.schedule.deleteMany({ where: { id: ctx.scheduleId } });
  await prisma.bankHourBalance.deleteMany({ where: { memberId: ctx.memberId } });
  await prisma.teamMember.deleteMany({ where: { id: ctx.memberId } });
  await prisma.teamLevel.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.teamShift.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.team.deleteMany({ where: { id: ctx.teamId } });
}

export async function createOffAssignmentOnDate(
  ctx: OffHoursRequestTestContext,
): Promise<void> {
  await prisma.scheduleAssignment.create({
    data: {
      scheduleId: ctx.scheduleId,
      memberId: ctx.memberId,
      date: ctx.workDateUtc,
      status: AssignmentStatus.OFF,
    },
  });
}

export async function createPendingOffHoursRequestSameDay(
  ctx: OffHoursRequestTestContext,
  hours: number,
): Promise<void> {
  await prisma.bankHourRequest.create({
    data: {
      type: BankHourRequestType.OFF_HOURS,
      requesterId: ctx.memberId,
      date: ctx.workDateUtc,
      hours,
      justification: "Pedido anterior (teste)",
      status: BankHourRequestStatus.PENDING,
    },
  });
}

/** Membro + equipe sem escala no mês (para erro “Escala do mês não encontrada”). */
export async function createMemberTeamWithoutSchedule(): Promise<{ teamId: string; memberId: string }> {
  const suffix = randomBytes(4).toString("hex");
  const team = await prisma.team.create({
    data: { name: `mops-bh-ns-${suffix}`, isDefault: false },
  });
  const { levelIds, shiftIds } = await ensureLegacyCatalogForTeam(team.id);
  const member = await prisma.teamMember.create({
    data: {
      teamId: team.id,
      teamLevelId: levelIds[Level.N1],
      teamShiftId: shiftIds[Shift.T1],
      name: "Membro sem escala",
      phone: `21988${suffix.slice(0, 5)}`,
      normalizedPhone: `5521988${suffix.slice(0, 5)}`,
      level: Level.N1,
      shift: Shift.T1,
    },
  });
  return { teamId: team.id, memberId: member.id };
}

export async function destroyMemberTeamOnly(ctx: { teamId: string; memberId: string }): Promise<void> {
  await prisma.bankHourRequest.deleteMany({ where: { requesterId: ctx.memberId } });
  await prisma.bankHourBalance.deleteMany({ where: { memberId: ctx.memberId } });
  await prisma.teamMember.deleteMany({ where: { id: ctx.memberId } });
  await prisma.teamLevel.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.teamShift.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.team.deleteMany({ where: { id: ctx.teamId } });
}

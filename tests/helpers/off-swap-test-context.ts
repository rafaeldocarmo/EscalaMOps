import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  AssignmentStatus,
  ScheduleStatus,
} from "@/lib/generated/prisma/enums";
import { ensureCatalogForTeam } from "@/tests/helpers/team-crud-context";

const YEAR = 2099;
const MONTH = 7;

export const OFF_SWAP_ORIGINAL_KEY = "2099-07-10";
export const OFF_SWAP_TARGET_KEY = "2099-07-20";

export function parseSwapDateUtc(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`);
}

export type OffSwapTwoMemberContext = {
  teamId: string;
  requesterId: string;
  targetMemberId: string;
  scheduleId: string;
};

export type OffSwapLegadoContext = {
  teamId: string;
  requesterId: string;
  scheduleId: string;
};

async function createTeamWithSchedule(suffix: string) {
  const team = await prisma.team.create({
    data: { name: `mops-swap-${suffix}`, isDefault: false },
  });
  const { levelIds, shiftIds } = await ensureCatalogForTeam(team.id);
  const schedule = await prisma.schedule.create({
    data: { teamId: team.id, year: YEAR, month: MONTH, status: ScheduleStatus.OPEN },
  });
  return { team, schedule, levelIds, shiftIds };
}

function memberData(
  teamId: string,
  slot: number,
  suffix: string,
  levelLabel: string,
  shiftLabel: string,
  levelIds: Record<string, string>,
  shiftIds: Record<string, string>,
) {
  const tail = `${suffix.replace(/[^a-f0-9]/g, "")}${slot}`.slice(0, 9).padStart(9, "0");
  return {
    teamId,
    teamLevelId: levelIds[levelLabel],
    teamShiftId: shiftIds[shiftLabel],
    name: `Membro ${suffix}-${slot}`,
    phone: `11${tail}`,
    normalizedPhone: `5511${tail}`,
  };
}

export async function createOffSwapLegadoContext(): Promise<OffSwapLegadoContext> {
  const suffix = randomBytes(4).toString("hex");
  const { team, schedule, levelIds, shiftIds } = await createTeamWithSchedule(suffix);
  const requester = await prisma.teamMember.create({
    data: memberData(team.id, 1, suffix, "N1", "T1", levelIds, shiftIds),
  });
  await prisma.scheduleAssignment.create({
    data: {
      scheduleId: schedule.id,
      memberId: requester.id,
      date: parseSwapDateUtc(OFF_SWAP_ORIGINAL_KEY),
      status: AssignmentStatus.OFF,
    },
  });
  return { teamId: team.id, requesterId: requester.id, scheduleId: schedule.id };
}

export async function createOffSwapTwoMemberContext(): Promise<OffSwapTwoMemberContext> {
  const suffix = randomBytes(4).toString("hex");
  const { team, schedule, levelIds, shiftIds } = await createTeamWithSchedule(suffix);
  const requester = await prisma.teamMember.create({
    data: memberData(team.id, 1, suffix, "N1", "T1", levelIds, shiftIds),
  });
  const target = await prisma.teamMember.create({
    data: memberData(team.id, 2, suffix, "N1", "T1", levelIds, shiftIds),
  });
  const dOrig = parseSwapDateUtc(OFF_SWAP_ORIGINAL_KEY);
  const dTarg = parseSwapDateUtc(OFF_SWAP_TARGET_KEY);

  await prisma.scheduleAssignment.createMany({
    data: [
      { scheduleId: schedule.id, memberId: requester.id, date: dOrig, status: AssignmentStatus.OFF },
      { scheduleId: schedule.id, memberId: target.id, date: dTarg, status: AssignmentStatus.OFF },
    ],
  });

  return {
    teamId: team.id,
    requesterId: requester.id,
    targetMemberId: target.id,
    scheduleId: schedule.id,
  };
}

export async function destroyOffSwapLegadoContext(ctx: OffSwapLegadoContext): Promise<void> {
  await prisma.scheduleSwapRequest.deleteMany({
    where: { OR: [{ requesterId: ctx.requesterId }, { targetMemberId: ctx.requesterId }] },
  });
  await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: ctx.scheduleId } });
  await prisma.schedule.deleteMany({ where: { id: ctx.scheduleId } });
  await prisma.teamMember.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.teamLevel.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.teamShift.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.team.deleteMany({ where: { id: ctx.teamId } });
}

export async function destroyOffSwapTwoMemberContext(ctx: OffSwapTwoMemberContext): Promise<void> {
  await prisma.scheduleSwapRequest.deleteMany({
    where: {
      OR: [
        { requesterId: ctx.requesterId },
        { targetMemberId: ctx.requesterId },
        { requesterId: ctx.targetMemberId },
        { targetMemberId: ctx.targetMemberId },
      ],
    },
  });
  await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: ctx.scheduleId } });
  await prisma.schedule.deleteMany({ where: { id: ctx.scheduleId } });
  await prisma.teamMember.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.teamLevel.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.teamShift.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.team.deleteMany({ where: { id: ctx.teamId } });
}

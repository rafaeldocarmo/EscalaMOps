import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ScheduleStatus } from "@/lib/generated/prisma/enums";

export function uniqueTeamName(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

export async function createEmptyTeam(name: string) {
  return prisma.team.create({
    data: { name, isDefault: false },
  });
}

const LEVEL_SPECS = [
  { label: "N1", sortOrder: 0 },
  { label: "N2", sortOrder: 1 },
  { label: "ESPC", sortOrder: 2 },
  { label: "Produção", sortOrder: 3 },
];

const SHIFT_SPECS = [
  { label: "T1", sortOrder: 0 },
  { label: "T2", sortOrder: 1 },
  { label: "T3", sortOrder: 2 },
  { label: "TC", sortOrder: 3 },
];

/**
 * Cria o catálogo completo na equipe informada:
 * 4 níveis + 4 turnos + matriz 4×4.
 *
 * Devolve dicionários `label -> id` para facilitar o `prisma.teamMember.create`.
 */
export async function ensureCatalogForTeam(teamId: string) {
  await Promise.all([
    prisma.teamLevel.createMany({
      data: LEVEL_SPECS.map((s) => ({ teamId, label: s.label, sortOrder: s.sortOrder })),
      skipDuplicates: true,
    }),
    prisma.teamShift.createMany({
      data: SHIFT_SPECS.map((s) => ({ teamId, label: s.label, sortOrder: s.sortOrder })),
      skipDuplicates: true,
    }),
  ]);

  const [levels, shifts] = await Promise.all([
    prisma.teamLevel.findMany({
      where: { teamId, label: { in: LEVEL_SPECS.map((s) => s.label) } },
      select: { id: true, label: true },
    }),
    prisma.teamShift.findMany({
      where: { teamId, label: { in: SHIFT_SPECS.map((s) => s.label) } },
      select: { id: true, label: true },
    }),
  ]);

  const levelIds = {} as Record<string, string>;
  for (const l of levels) levelIds[l.label] = l.id;
  const shiftIds = {} as Record<string, string>;
  for (const s of shifts) shiftIds[s.label] = s.id;

  const pairs: { teamLevelId: string; teamShiftId: string }[] = [];
  for (const lv of LEVEL_SPECS) {
    for (const sh of SHIFT_SPECS) {
      if (levelIds[lv.label] && shiftIds[sh.label]) {
        pairs.push({ teamLevelId: levelIds[lv.label], teamShiftId: shiftIds[sh.label] });
      }
    }
  }
  await prisma.teamLevelAllowedShift.createMany({ data: pairs, skipDuplicates: true });

  return { levelIds, shiftIds };
}

/** @deprecated Use ensureCatalogForTeam */
export const ensureLegacyCatalogForTeam = ensureCatalogForTeam;

/**
 * Cria Team pronta para testes que cadastrem membros.
 */
export async function createTeamWithLegacyCatalog(name: string) {
  const team = await createEmptyTeam(name);
  const catalog = await ensureCatalogForTeam(team.id);
  return { team, ...catalog };
}

export async function createTestTeamMember(teamId: string) {
  const { levelIds, shiftIds } = await ensureCatalogForTeam(teamId);
  const tail = randomBytes(3).toString("hex");
  return prisma.teamMember.create({
    data: {
      teamId,
      teamLevelId: levelIds["N1"],
      teamShiftId: shiftIds["T1"],
      name: "Membro CRUD teste",
      phone: `11988${tail}`,
      normalizedPhone: `5511988${tail}`,
    },
  });
}

/**
 * Monta input válido para createTeamMember/updateTeamMember usando o catálogo
 * da equipe. Provê N1/T1 por padrão.
 */
export async function buildValidMemberInput(
  teamId: string,
  overrides?: Partial<{
    name: string;
    phone: string;
    levelLabel: string;
    shiftLabel: string;
    sobreaviso: boolean;
    participatesInSchedule: boolean;
  }>,
) {
  const wantedLevel = overrides?.levelLabel ?? "N1";
  const wantedShift = overrides?.shiftLabel ?? "T1";
  const [level, shift] = await Promise.all([
    prisma.teamLevel.findFirst({ where: { teamId, label: wantedLevel }, select: { id: true } }),
    prisma.teamShift.findFirst({ where: { teamId, label: wantedShift }, select: { id: true } }),
  ]);
  if (!level || !shift) {
    throw new Error(
      `buildValidMemberInput: catálogo não encontrado para teamId=${teamId}. ` +
        "Chame createTeamWithLegacyCatalog/ensureCatalogForTeam antes.",
    );
  }
  return {
    name: overrides?.name ?? "Membro Integração",
    phone: overrides?.phone ?? "11987654321",
    teamLevelId: level.id,
    teamShiftId: shift.id,
    sobreaviso: overrides?.sobreaviso ?? false,
    participatesInSchedule: overrides?.participatesInSchedule ?? true,
  };
}

export async function createTestSchedule(teamId: string, year: number, month: number) {
  return prisma.schedule.create({
    data: { teamId, year, month, status: ScheduleStatus.OPEN },
  });
}

export async function cleanupTeamCascade(teamId: string): Promise<void> {
  const schedules = await prisma.schedule.findMany({ where: { teamId }, select: { id: true } });
  for (const s of schedules) {
    await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: s.id } });
  }
  await prisma.schedule.deleteMany({ where: { teamId } });
  await prisma.teamMember.deleteMany({ where: { teamId } });
  await prisma.teamLevel.deleteMany({ where: { teamId } });
  await prisma.teamShift.deleteMany({ where: { teamId } });
  await prisma.team.deleteMany({ where: { id: teamId } });
}

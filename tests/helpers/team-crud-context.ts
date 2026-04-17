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

/**
 * Cria (idempotente) o catálogo "legado" completo na equipe informada:
 * 4 níveis (N1/N2/ESPC/PRODUCAO) + 4 turnos (T1/T2/T3/TC) + matriz 4×4.
 *
 * Devolve dicionários `kind -> id` para facilitar o `prisma.teamMember.create`
 * em helpers de teste. Testes que validam fluxos "sem catálogo" NÃO devem
 * chamar essa função.
 */
export async function ensureLegacyCatalogForTeam(teamId: string) {
  const levelSpecs: { kind: Level; label: string; sortOrder: number }[] = [
    { kind: Level.N1, label: "N1", sortOrder: 0 },
    { kind: Level.N2, label: "N2", sortOrder: 1 },
    { kind: Level.ESPC, label: "ESPC", sortOrder: 2 },
    { kind: Level.PRODUCAO, label: "Produção", sortOrder: 3 },
  ];
  const shiftSpecs: { kind: Shift; label: string; sortOrder: number }[] = [
    { kind: Shift.T1, label: "T1", sortOrder: 0 },
    { kind: Shift.T2, label: "T2", sortOrder: 1 },
    { kind: Shift.T3, label: "T3", sortOrder: 2 },
    { kind: Shift.TC, label: "TC", sortOrder: 3 },
  ];

  const levelIds = {} as Record<Level, string>;
  for (const spec of levelSpecs) {
    const row = await prisma.teamLevel.upsert({
      where: { teamId_legacyKind: { teamId, legacyKind: spec.kind } },
      create: { teamId, label: spec.label, legacyKind: spec.kind, sortOrder: spec.sortOrder },
      update: {},
      select: { id: true },
    });
    levelIds[spec.kind] = row.id;
  }

  const shiftIds = {} as Record<Shift, string>;
  for (const spec of shiftSpecs) {
    const row = await prisma.teamShift.upsert({
      where: { teamId_legacyKind: { teamId, legacyKind: spec.kind } },
      create: { teamId, label: spec.label, legacyKind: spec.kind, sortOrder: spec.sortOrder },
      update: {},
      select: { id: true },
    });
    shiftIds[spec.kind] = row.id;
  }

  for (const lv of levelSpecs) {
    for (const sh of shiftSpecs) {
      await prisma.teamLevelAllowedShift.upsert({
        where: {
          teamLevelId_teamShiftId: {
            teamLevelId: levelIds[lv.kind],
            teamShiftId: shiftIds[sh.kind],
          },
        },
        create: { teamLevelId: levelIds[lv.kind], teamShiftId: shiftIds[sh.kind] },
        update: {},
      });
    }
  }

  return { levelIds, shiftIds };
}

/**
 * Cria Team pronta para testes que cadastrem membros: com catálogo legado
 * completo e matriz 4×4.
 */
export async function createTeamWithLegacyCatalog(name: string) {
  const team = await createEmptyTeam(name);
  const catalog = await ensureLegacyCatalogForTeam(team.id);
  return { team, ...catalog };
}

export async function createTestTeamMember(teamId: string) {
  const { levelIds, shiftIds } = await ensureLegacyCatalogForTeam(teamId);
  const tail = randomBytes(3).toString("hex");
  return prisma.teamMember.create({
    data: {
      teamId,
      teamLevelId: levelIds[Level.N1],
      teamShiftId: shiftIds[Shift.T1],
      name: "Membro CRUD teste",
      phone: `11988${tail}`,
      normalizedPhone: `5511988${tail}`,
      level: Level.N1,
      shift: Shift.T1,
    },
  });
}

/**
 * Monta input válido para createTeamMember/updateTeamMember usando o catálogo
 * legado da equipe (níveis/turnos com legacyKind). Provê N1/T1 por padrão.
 */
export async function buildValidMemberInput(
  teamId: string,
  overrides?: Partial<{
    name: string;
    phone: string;
    level: Level;
    shift: Shift;
    sobreaviso: boolean;
    participatesInSchedule: boolean;
  }>,
) {
  const { levelIds, shiftIds } = await ensureLegacyCatalogForTeam(teamId);
  return {
    name: overrides?.name ?? "Membro Integração",
    phone: overrides?.phone ?? "11987654321",
    teamLevelId: levelIds[overrides?.level ?? Level.N1],
    teamShiftId: shiftIds[overrides?.shift ?? Shift.T1],
    sobreaviso: overrides?.sobreaviso ?? false,
    participatesInSchedule: overrides?.participatesInSchedule ?? true,
  };
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

/** Remove equipe de teste (membros, atribuições de escala, escalas, catálogo). */
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
  // Catálogo (níveis/turnos/matriz) cai em cascata via FK onDelete: Cascade em TeamLevel/TeamShift,
  // mas removemos explicitamente para manter simétrico com o fluxo de criação por helpers.
  await prisma.teamLevel.deleteMany({ where: { teamId } });
  await prisma.teamShift.deleteMany({ where: { teamId } });
  await prisma.team.deleteMany({ where: { id: teamId } });
}

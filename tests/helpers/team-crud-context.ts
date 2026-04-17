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

  // Fase 1: cria tudo em paralelo via createMany (skipDuplicates garante idempotência).
  await Promise.all([
    prisma.teamLevel.createMany({
      data: levelSpecs.map((s) => ({
        teamId,
        label: s.label,
        legacyKind: s.kind,
        sortOrder: s.sortOrder,
      })),
      skipDuplicates: true,
    }),
    prisma.teamShift.createMany({
      data: shiftSpecs.map((s) => ({
        teamId,
        label: s.label,
        legacyKind: s.kind,
        sortOrder: s.sortOrder,
      })),
      skipDuplicates: true,
    }),
  ]);

  // Fase 2: lê os IDs (em paralelo).
  const [levels, shifts] = await Promise.all([
    prisma.teamLevel.findMany({
      where: { teamId, legacyKind: { in: levelSpecs.map((s) => s.kind) } },
      select: { id: true, legacyKind: true },
    }),
    prisma.teamShift.findMany({
      where: { teamId, legacyKind: { in: shiftSpecs.map((s) => s.kind) } },
      select: { id: true, legacyKind: true },
    }),
  ]);

  const levelIds = {} as Record<Level, string>;
  for (const l of levels) if (l.legacyKind) levelIds[l.legacyKind] = l.id;
  const shiftIds = {} as Record<Shift, string>;
  for (const s of shifts) if (s.legacyKind) shiftIds[s.legacyKind] = s.id;

  // Fase 3: matriz 4x4 em um único createMany.
  const pairs: { teamLevelId: string; teamShiftId: string }[] = [];
  for (const lv of levelSpecs) {
    for (const sh of shiftSpecs) {
      pairs.push({ teamLevelId: levelIds[lv.kind], teamShiftId: shiftIds[sh.kind] });
    }
  }
  await prisma.teamLevelAllowedShift.createMany({
    data: pairs,
    skipDuplicates: true,
  });

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
  // Lookup puro (SELECT) para não reexecutar os 24 upserts de
  // `ensureLegacyCatalogForTeam` a cada chamada. Assume que o catálogo
  // legado já foi criado (ex.: via `createTeamWithLegacyCatalog`).
  const wantedLevel = overrides?.level ?? Level.N1;
  const wantedShift = overrides?.shift ?? Shift.T1;
  const [level, shift] = await Promise.all([
    prisma.teamLevel.findFirst({
      where: { teamId, legacyKind: wantedLevel },
      select: { id: true },
    }),
    prisma.teamShift.findFirst({
      where: { teamId, legacyKind: wantedShift },
      select: { id: true },
    }),
  ]);
  if (!level || !shift) {
    throw new Error(
      `buildValidMemberInput: catálogo legado não encontrado para teamId=${teamId}. ` +
        "Chame createTeamWithLegacyCatalog/ensureLegacyCatalogForTeam antes.",
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

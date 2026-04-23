import type { PrismaClient } from "@/lib/generated/prisma/client";
import { RuleKind, Level, Shift } from "@/lib/generated/prisma/enums";

/**
 * Defaults para cobertura de fim de semana por par (Turno × Nível).
 *
 * Reproduz a matriz que vivia hardcoded em `queueManager.ts` (WEEKEND_COVERAGE).
 * `count=0` = grupo sempre folga; `count>0` = grupo entra no rodízio.
 *
 * Valores semeados para toda combinação legada; níveis/turnos personalizados
 * (legacyKind=null) não recebem default — são configurados pela UI depois.
 */
const DEFAULT_WEEKEND_COVERAGE: Record<string, number> = {
  [`${Shift.T1}_${Level.N1}`]: 1,
  [`${Shift.T1}_${Level.N2}`]: 2,
  [`${Shift.T1}_${Level.ESPC}`]: 0,
  [`${Shift.T1}_${Level.PRODUCAO}`]: 0,
  [`${Shift.T2}_${Level.N1}`]: 1,
  [`${Shift.T2}_${Level.N2}`]: 2,
  [`${Shift.T2}_${Level.ESPC}`]: 0,
  [`${Shift.T2}_${Level.PRODUCAO}`]: 0,
  [`${Shift.T3}_${Level.N1}`]: 1,
  [`${Shift.T3}_${Level.N2}`]: 0,
  [`${Shift.T3}_${Level.ESPC}`]: 0,
  [`${Shift.T3}_${Level.PRODUCAO}`]: 0,
  [`${Shift.TC}_${Level.N1}`]: 0,
  [`${Shift.TC}_${Level.N2}`]: 0,
  [`${Shift.TC}_${Level.ESPC}`]: 0,
  [`${Shift.TC}_${Level.PRODUCAO}`]: 0,
};

/**
 * Defaults de padrão de compensação (dias da semana usados para OFF antes e
 * depois de um FDS trabalhado). Reproduz `COMPENSATION_GABARITO` de
 * `offDayAllocator.ts`.
 *
 * Dias: 1=seg, 2=ter, 3=qua, 4=qui, 5=sex.
 */
type PatternEntry = { dayBefore: number; dayAfter: number };
const DEFAULT_COMPENSATION_PATTERNS: Record<string, PatternEntry[]> = {
  [`${Shift.T1}_${Level.N1}`]: [{ dayBefore: 4, dayAfter: 3 }],
  [`${Shift.T2}_${Level.N1}`]: [{ dayBefore: 4, dayAfter: 3 }],
  [`${Shift.T3}_${Level.N1}`]: [{ dayBefore: 4, dayAfter: 3 }],
  [`${Shift.T1}_${Level.N2}`]: [
    { dayBefore: 3, dayAfter: 2 },
    { dayBefore: 4, dayAfter: 3 },
  ],
  [`${Shift.T2}_${Level.N2}`]: [
    { dayBefore: 3, dayAfter: 2 },
    { dayBefore: 4, dayAfter: 3 },
  ],
};

interface CatalogEntry {
  id: string;
  legacyKind: string | null;
}

/**
 * Garante as regras default para uma equipe. Idempotente: só cria regras para
 * pares (shift, level) que ainda não possuem uma regra daquele kind no escopo
 * exato. Nunca sobrescreve uma regra já configurada manualmente.
 */
export async function seedDefaultScheduleRulesForTeam(
  prisma: PrismaClient,
  teamId: string
): Promise<{ createdWeekendCoverage: number; createdCompensation: number }> {
  const [shifts, levels, existingRules] = await Promise.all([
    prisma.teamShift.findMany({
      where: { teamId },
      select: { id: true, legacyKind: true },
    }),
    prisma.teamLevel.findMany({
      where: { teamId },
      select: { id: true, legacyKind: true },
    }),
    prisma.scheduleRule.findMany({
      where: { teamId },
      select: {
        kind: true,
        teamShiftId: true,
        teamLevelId: true,
      },
    }),
  ]);

  const existingKey = (
    kind: string,
    shiftId: string | null,
    levelId: string | null
  ) => `${kind}|${shiftId ?? ""}|${levelId ?? ""}`;
  const existingSet = new Set(
    existingRules.map((r) => existingKey(r.kind, r.teamShiftId, r.teamLevelId))
  );

  const creates: {
    teamId: string;
    teamShiftId: string | null;
    teamLevelId: string | null;
    kind: RuleKind;
    params: PatternEntry[] | { count: number };
  }[] = [];

  for (const shift of shifts as CatalogEntry[]) {
    for (const level of levels as CatalogEntry[]) {
      if (!shift.legacyKind || !level.legacyKind) continue;
      const k = `${shift.legacyKind}_${level.legacyKind}`;

      const coverageCount = DEFAULT_WEEKEND_COVERAGE[k];
      if (coverageCount !== undefined) {
        const key = existingKey(RuleKind.WEEKEND_COVERAGE, shift.id, level.id);
        if (!existingSet.has(key)) {
          creates.push({
            teamId,
            teamShiftId: shift.id,
            teamLevelId: level.id,
            kind: RuleKind.WEEKEND_COVERAGE,
            params: { count: coverageCount },
          });
        }
      }

      const patterns = DEFAULT_COMPENSATION_PATTERNS[k];
      if (patterns) {
        const key = existingKey(RuleKind.COMPENSATION_PATTERN, shift.id, level.id);
        if (!existingSet.has(key)) {
          creates.push({
            teamId,
            teamShiftId: shift.id,
            teamLevelId: level.id,
            kind: RuleKind.COMPENSATION_PATTERN,
            params: { patterns } as unknown as PatternEntry[],
          });
        }
      }
    }
  }

  let createdWeekendCoverage = 0;
  let createdCompensation = 0;
  for (const row of creates) {
    await prisma.scheduleRule.create({
      data: {
        teamId: row.teamId,
        teamShiftId: row.teamShiftId,
        teamLevelId: row.teamLevelId,
        kind: row.kind,
        params: row.params as object,
      },
    });
    if (row.kind === RuleKind.WEEKEND_COVERAGE) createdWeekendCoverage++;
    else createdCompensation++;
  }

  return { createdWeekendCoverage, createdCompensation };
}

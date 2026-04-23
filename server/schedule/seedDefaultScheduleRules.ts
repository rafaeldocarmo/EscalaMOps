import type { PrismaClient } from "@/lib/generated/prisma/client";
import { RuleKind } from "@/lib/generated/prisma/enums";

/**
 * Garante uma regra WEEKEND_COVERAGE padrão para cada par (shift × level) de uma
 * equipe que ainda não tenha essa regra configurada. Idempotente.
 *
 * Os valores padrão (count=1) são uma base razoável; o admin ajusta depois
 * na tela de Regras de Escala.
 */
export async function seedDefaultScheduleRulesForTeam(
  prisma: PrismaClient,
  teamId: string
): Promise<{ createdWeekendCoverage: number; createdCompensation: number }> {
  const [shifts, levels, allowedPairs, existingRules] = await Promise.all([
    prisma.teamShift.findMany({ where: { teamId }, select: { id: true } }),
    prisma.teamLevel.findMany({ where: { teamId }, select: { id: true } }),
    prisma.teamLevelAllowedShift.findMany({
      where: { teamLevel: { teamId } },
      select: { teamLevelId: true, teamShiftId: true },
    }),
    prisma.scheduleRule.findMany({
      where: { teamId },
      select: { kind: true, teamShiftId: true, teamLevelId: true },
    }),
  ]);

  const existingKey = (kind: string, shiftId: string | null, levelId: string | null) =>
    `${kind}|${shiftId ?? ""}|${levelId ?? ""}`;
  const existingSet = new Set(
    existingRules.map((r) => existingKey(r.kind, r.teamShiftId, r.teamLevelId))
  );

  const shiftIds = new Set(shifts.map((s) => s.id));
  const levelIds = new Set(levels.map((l) => l.id));

  let createdWeekendCoverage = 0;
  const createdCompensation = 0;

  for (const pair of allowedPairs) {
    if (!shiftIds.has(pair.teamShiftId) || !levelIds.has(pair.teamLevelId)) continue;

    const key = existingKey(RuleKind.WEEKEND_COVERAGE, pair.teamShiftId, pair.teamLevelId);
    if (!existingSet.has(key)) {
      await prisma.scheduleRule.create({
        data: {
          teamId,
          teamShiftId: pair.teamShiftId,
          teamLevelId: pair.teamLevelId,
          kind: RuleKind.WEEKEND_COVERAGE,
          params: { count: 1 },
        },
      });
      createdWeekendCoverage++;
    }
  }

  return { createdWeekendCoverage, createdCompensation };
}

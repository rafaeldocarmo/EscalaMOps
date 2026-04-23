import { prisma } from "@/lib/prisma";
import { RuleKind } from "@/lib/generated/prisma/enums";
import {
  parseParamsForKind,
  type CompensationPatternParams,
  type WeekendCoverageParams,
} from "@/lib/validations/scheduleRule";

/**
 * Regras resolvidas por (teamShiftId × teamLevelId) de uma equipe.
 *
 * O motor de geração de escala consulta este objeto em vez das constantes
 * hardcoded (`WEEKEND_COVERAGE`, `COMPENSATION_GABARITO`) que existiam antes.
 *
 * Estratégia de resolução: para cada célula (shiftId, levelId), buscamos a
 * regra habilitada mais específica por `kind`, com esta ordem de precedência:
 *   1. shift + level preenchidos
 *   2. shift apenas
 *   3. level apenas
 *   4. team (ambos null)
 *
 * Empates no mesmo nível de especificidade são desempatados por `priority`
 * mais alta e, em último caso, `updatedAt` mais recente.
 */
export interface ResolvedRuleSet {
  teamId: string;
  weekendCoverage: Map<string, WeekendCoverageParams>;
  compensationPattern: Map<string, CompensationPatternParams>;
}

/** Chave interna da matriz. */
function cellKey(shiftId: string, levelId: string): string {
  return `${shiftId}|${levelId}`;
}

export function cellKeyForMember(shiftId: string, levelId: string): string {
  return cellKey(shiftId, levelId);
}

type DbRule = {
  id: string;
  kind: RuleKind;
  teamShiftId: string | null;
  teamLevelId: string | null;
  priority: number;
  updatedAt: Date;
  params: unknown;
};

/**
 * Retorna um score de "especificidade" do escopo. Quanto maior, mais específico.
 * shift+level = 3, shift only = 2, level only = 1, global = 0.
 */
function specificityScore(rule: DbRule): number {
  if (rule.teamShiftId && rule.teamLevelId) return 3;
  if (rule.teamShiftId) return 2;
  if (rule.teamLevelId) return 1;
  return 0;
}

/**
 * Seleciona a regra mais específica aplicável à célula (shiftId, levelId)
 * dentre as candidatas. Retorna `null` se nenhuma casa.
 */
function pickBestRule(
  rules: DbRule[],
  shiftId: string,
  levelId: string
): DbRule | null {
  const applicable = rules.filter(
    (r) =>
      (r.teamShiftId === null || r.teamShiftId === shiftId) &&
      (r.teamLevelId === null || r.teamLevelId === levelId)
  );
  if (applicable.length === 0) return null;
  applicable.sort((a, b) => {
    const sa = specificityScore(a);
    const sb = specificityScore(b);
    if (sa !== sb) return sb - sa;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return applicable[0];
}

/**
 * Carrega todas as regras habilitadas da equipe e monta o `ResolvedRuleSet`
 * para cada par (shift, level) cadastrado na equipe.
 *
 * Se a equipe ainda não tiver regras configuradas, retorna um conjunto vazio —
 * o motor de geração trata isso como "grupo não trabalha no FDS".
 */
export async function resolveScheduleRules(teamId: string): Promise<ResolvedRuleSet> {
  const [rules, shifts, levels] = await Promise.all([
    prisma.scheduleRule.findMany({
      where: { teamId, enabled: true },
      select: {
        id: true,
        kind: true,
        teamShiftId: true,
        teamLevelId: true,
        priority: true,
        updatedAt: true,
        params: true,
      },
    }),
    prisma.teamShift.findMany({
      where: { teamId },
      select: { id: true },
    }),
    prisma.teamLevel.findMany({
      where: { teamId },
      select: { id: true },
    }),
  ]);

  const weekendCoverage = new Map<string, WeekendCoverageParams>();
  const compensationPattern = new Map<string, CompensationPatternParams>();

  const weekendRules = rules.filter((r) => r.kind === RuleKind.WEEKEND_COVERAGE);
  const compRules = rules.filter((r) => r.kind === RuleKind.COMPENSATION_PATTERN);

  for (const shift of shifts) {
    for (const level of levels) {
      const key = cellKey(shift.id, level.id);
      const wc = pickBestRule(weekendRules, shift.id, level.id);
      if (wc) {
        try {
          weekendCoverage.set(
            key,
            parseParamsForKind(RuleKind.WEEKEND_COVERAGE, wc.params) as WeekendCoverageParams
          );
        } catch {
          // Params inválido — ignora (motor trata como sem cobertura).
        }
      }
      const cp = pickBestRule(compRules, shift.id, level.id);
      if (cp) {
        try {
          compensationPattern.set(
            key,
            parseParamsForKind(RuleKind.COMPENSATION_PATTERN, cp.params) as CompensationPatternParams
          );
        } catch {
          // Params inválido — ignora.
        }
      }
    }
  }

  return { teamId, weekendCoverage, compensationPattern };
}

/** Quantas pessoas do grupo devem trabalhar no FDS. 0 = grupo folga. */
export function getWeekendCoverageCount(
  resolved: ResolvedRuleSet,
  shiftId: string,
  levelId: string
): number {
  return resolved.weekendCoverage.get(cellKey(shiftId, levelId))?.count ?? 0;
}

/** Padrão(ões) de compensação configurado(s) para o grupo. Vazio = sem compensação. */
export function getCompensationPatterns(
  resolved: ResolvedRuleSet,
  shiftId: string,
  levelId: string
): CompensationPatternParams["patterns"] {
  return resolved.compensationPattern.get(cellKey(shiftId, levelId))?.patterns ?? [];
}

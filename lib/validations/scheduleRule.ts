import { z } from "zod";
import { RuleKind } from "@/lib/generated/prisma/enums";

/**
 * Schemas Zod para os parâmetros (`params`) de cada `RuleKind`.
 *
 * Toda regra é persistida com `params` como JSON no banco. O shape depende do
 * `kind` e é sempre validado por estes schemas antes de gravar — assim nenhum
 * kind entra no banco com payload inválido e o motor de geração pode confiar
 * no formato na hora de consumir.
 */

const weekdayIndexSchema = z
  .number()
  .int()
  .min(1, "Dia deve ser entre segunda (1) e sexta (5).")
  .max(5, "Dia deve ser entre segunda (1) e sexta (5).");

export const weekendCoverageParamsSchema = z.object({
  /** Quantas pessoas do escopo trabalham no fim de semana. 0 = grupo sempre folga. */
  count: z
    .number()
    .int("Quantidade deve ser um número inteiro.")
    .min(0, "Quantidade não pode ser negativa.")
    .max(20, "Quantidade muito alta."),
});
export type WeekendCoverageParams = z.infer<typeof weekendCoverageParamsSchema>;

export const compensationPatternEntrySchema = z.object({
  /** 1=seg, 2=ter, 3=qua, 4=qui, 5=sex — dia da semana ANTERIOR ao sábado. */
  dayBefore: weekdayIndexSchema,
  /** 1=seg, 2=ter, 3=qua, 4=qui, 5=sex — dia da semana POSTERIOR ao domingo. */
  dayAfter: weekdayIndexSchema,
});
export type CompensationPatternEntry = z.infer<typeof compensationPatternEntrySchema>;

export const compensationPatternParamsSchema = z.object({
  /**
   * Padrões de compensação por pessoa do grupo. A 1ª pessoa do grupo usa
   * `patterns[0]`, a 2ª `patterns[1]`, etc. Se houver mais pessoas que
   * padrões, reutiliza (i % patterns.length).
   */
  patterns: z
    .array(compensationPatternEntrySchema)
    .min(1, "Informe ao menos um padrão de compensação."),
});
export type CompensationPatternParams = z.infer<typeof compensationPatternParamsSchema>;

/** Discriminated union: params + kind, para uso genérico no motor. */
export type ScheduleRuleParams =
  | { kind: typeof RuleKind.WEEKEND_COVERAGE; params: WeekendCoverageParams }
  | { kind: typeof RuleKind.COMPENSATION_PATTERN; params: CompensationPatternParams };

/** Schema para parsear `params` com base no `kind`. Usado em server actions e no resolver. */
export function paramsSchemaForKind(kind: RuleKind) {
  switch (kind) {
    case RuleKind.WEEKEND_COVERAGE:
      return weekendCoverageParamsSchema;
    case RuleKind.COMPENSATION_PATTERN:
      return compensationPatternParamsSchema;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Tipo de regra não suportado: ${String(_exhaustive)}`);
    }
  }
}

const ruleKindSchema = z.enum([RuleKind.WEEKEND_COVERAGE, RuleKind.COMPENSATION_PATTERN]);

const baseScopeSchema = z.object({
  /** Omissão = usa a equipe resolvida da sessão. */
  teamId: z.string().min(1).optional(),
  teamShiftId: z.string().min(1).nullable().optional(),
  teamLevelId: z.string().min(1).nullable().optional(),
});

/**
 * Schema de criação: `params` é validado com base em `kind` via refinement.
 */
export const createScheduleRuleSchema = baseScopeSchema.extend({
  kind: ruleKindSchema,
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  params: z.unknown(),
}).superRefine((val, ctx) => {
  const schema = paramsSchemaForKind(val.kind);
  const parsed = schema.safeParse(val.params);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["params", ...issue.path],
        message: issue.message,
      });
    }
  }
});

/** Schema de atualização: escopo/kind não mudam; ajustes são em params/enabled/priority. */
export const updateScheduleRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  params: z.unknown().optional(),
});

export const deleteScheduleRuleSchema = z.object({
  id: z.string().min(1),
});

/** Valida o JSON `params` já tipado pelo `kind`. Usado ao ler do banco. */
export function parseParamsForKind(kind: RuleKind, params: unknown): ScheduleRuleParams["params"] {
  const schema = paramsSchemaForKind(kind);
  return schema.parse(params) as ScheduleRuleParams["params"];
}

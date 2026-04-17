import { z } from "zod";
import { Level, Shift } from "@/lib/generated/prisma/enums";

export const teamCatalogLabelSchema = z
  .string()
  .trim()
  .min(1, "Nome é obrigatório.")
  .max(120, "Nome muito longo.");

/**
 * `legacyKind` liga a entrada do catálogo a um dos valores do enum do sistema.
 * É o que permite à lógica de escala/sobreaviso enxergar o nível/turno. Se for
 * nulo, a entrada existe no catálogo mas não entra no formulário de membros até
 * que as regras sejam parametrizadas.
 */
const legacyLevelKindSchema = z
  .enum([Level.N1, Level.N2, Level.ESPC, Level.PRODUCAO])
  .nullable()
  .optional();

const legacyShiftKindSchema = z
  .enum([Shift.T1, Shift.T2, Shift.T3, Shift.TC])
  .nullable()
  .optional();

export const createTeamLevelSchema = z.object({
  teamId: z.string().min(1).optional(),
  label: teamCatalogLabelSchema,
  legacyKind: legacyLevelKindSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const updateTeamLevelSchema = z.object({
  id: z.string().min(1),
  label: teamCatalogLabelSchema.optional(),
  legacyKind: legacyLevelKindSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const createTeamShiftSchema = z.object({
  teamId: z.string().min(1).optional(),
  label: teamCatalogLabelSchema,
  legacyKind: legacyShiftKindSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const updateTeamShiftSchema = z.object({
  id: z.string().min(1),
  label: teamCatalogLabelSchema.optional(),
  legacyKind: legacyShiftKindSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const replaceAllowedShiftsForTeamLevelSchema = z.object({
  teamLevelId: z.string().min(1),
  /** Lista de ids de `TeamShift` da mesma equipe; substitui todos os vínculos atuais. */
  teamShiftIds: z.array(z.string().min(1)),
});

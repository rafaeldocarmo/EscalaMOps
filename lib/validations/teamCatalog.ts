import { z } from "zod";

export const teamCatalogLabelSchema = z
  .string()
  .trim()
  .min(1, "Nome é obrigatório.")
  .max(120, "Nome muito longo.");

export const createTeamLevelSchema = z.object({
  teamId: z.string().min(1).optional(),
  label: teamCatalogLabelSchema,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use um hex como #3b82f6.")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateTeamLevelSchema = z.object({
  id: z.string().min(1),
  label: teamCatalogLabelSchema.optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use um hex como #3b82f6.")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createTeamShiftSchema = z.object({
  teamId: z.string().min(1).optional(),
  label: teamCatalogLabelSchema,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use um hex como #3b82f6.")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateTeamShiftSchema = z.object({
  id: z.string().min(1),
  label: teamCatalogLabelSchema.optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use um hex como #3b82f6.")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const replaceAllowedShiftsForTeamLevelSchema = z.object({
  teamLevelId: z.string().min(1),
  /** Lista de ids de `TeamShift` da mesma equipe; substitui todos os vínculos atuais. */
  teamShiftIds: z.array(z.string().min(1)),
});

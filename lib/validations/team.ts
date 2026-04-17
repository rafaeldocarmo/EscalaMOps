import { z } from "zod";

const catalogId = z.string().min(1, "Selecione um valor do catálogo").max(64);

export const createTeamMemberSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(120),
  phone: z.string().min(10, "Telefone inválido").max(20),
  teamLevelId: catalogId,
  teamShiftId: catalogId,
  sobreaviso: z.boolean().default(false),
  participatesInSchedule: z.boolean().default(true),
});

export const updateTeamMemberSchema = createTeamMemberSchema;

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

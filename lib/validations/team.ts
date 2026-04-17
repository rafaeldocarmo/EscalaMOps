import { z } from "zod";
import { Level, Shift } from "@/lib/generated/prisma/enums";

export const createTeamMemberSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(120),
  phone: z.string().min(10, "Telefone inválido").max(20),
  level: z.enum([Level.N1, Level.N2, Level.ESPC, Level.PRODUCAO]),
  shift: z.enum([Shift.T1, Shift.T2, Shift.T3, Shift.TC]),
  sobreaviso: z.boolean().default(false),
  participatesInSchedule: z.boolean().default(true),
});

export const updateTeamMemberSchema = createTeamMemberSchema;

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

import { z } from "zod";
import { Level, Shift } from "@/lib/generated/prisma/enums";

const levelShiftSchema = z
  .object({
    level: z.enum([Level.N1, Level.N2, Level.ESPC, Level.PRODUCAO]),
    shift: z.enum([Shift.T1, Shift.T2, Shift.T3, Shift.TC]),
  })
  .refine(
    (data) => {
      if (data.level === Level.N2 && data.shift === Shift.T3) return false;
      if (data.shift === Shift.T3 && (data.level === Level.ESPC || data.level === Level.PRODUCAO)) return false;
      if (data.level === Level.ESPC && data.shift !== Shift.TC) return false;
      if (data.level === Level.PRODUCAO && data.shift !== Shift.TC) return false;
      if (data.shift === Shift.TC && data.level !== Level.ESPC && data.level !== Level.PRODUCAO) return false;
      return true;
    },
    {
      message:
        "N2 só pode estar nos turnos T1 ou T2. T3 aceita apenas N1. ESPC e Produção devem usar turno TC.",
      path: ["shift"],
    }
  );

export const createTeamMemberSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(120),
    phone: z.string().min(10, "Telefone inválido").max(20),
    level: z.enum([Level.N1, Level.N2, Level.ESPC, Level.PRODUCAO]),
    shift: z.enum([Shift.T1, Shift.T2, Shift.T3, Shift.TC]),
    sobreaviso: z.boolean().default(false),
  })
  .and(levelShiftSchema);

export const updateTeamMemberSchema = createTeamMemberSchema;

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

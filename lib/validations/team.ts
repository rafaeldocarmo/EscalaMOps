import { z } from "zod";
import { Level, Shift } from "@/lib/generated/prisma/enums";

export const levelShiftSchema = z
  .object({
    level: z.enum([Level.N1, Level.N2]),
    shift: z.enum([Shift.T1, Shift.T2, Shift.T3]),
  })
  .refine(
    (data) => {
      // N2 can only exist in T1 or T2
      if (data.level === Level.N2 && data.shift === Shift.T3) return false;
      // T3 only allows N1
      if (data.shift === Shift.T3 && data.level === Level.N2) return false;
      return true;
    },
    {
      message: "N2 só pode estar nos turnos T1 ou T2. Turno T3 aceita apenas N1.",
      path: ["shift"],
    }
  );

export const createTeamMemberSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(120),
    phone: z.string().min(10, "Telefone inválido").max(20),
    level: z.enum([Level.N1, Level.N2]),
    shift: z.enum([Shift.T1, Shift.T2, Shift.T3]),
  })
  .and(levelShiftSchema);

export const updateTeamMemberSchema = createTeamMemberSchema;

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

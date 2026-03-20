import { z } from "zod";

const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const extraHoursSchema = z.object({
  dateKey: z.string().regex(dateKeyRegex, "Data inválida."),
  hours: z
    .number()
    .finite()
    .positive("Horas devem ser maiores que zero.")
    .max(24, "Horas por dia muito altas."),
  justification: z.string().min(2, "Justificativa é obrigatória").max(500, "Justificativa muito longa."),
});

export const offHoursSchema = z.object({
  dateKey: z.string().regex(dateKeyRegex, "Data inválida."),
  hours: z
    .number()
    .finite()
    .positive("Horas devem ser maiores que zero.")
    .max(8, "Horas por dia muito altas (máximo 8)."),
  justification: z.string().min(2, "Justificativa é obrigatória").max(500, "Justificativa muito longa."),
});


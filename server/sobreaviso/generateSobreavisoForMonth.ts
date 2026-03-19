"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "date-fns";
import { generateSobreavisoSchedule } from "@/server/sobreaviso/generateSobreavisoSchedule";
import {
  getSobreavisoScheduleForMonth,
  type SobreavisoWeek,
} from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

export type GenerateSobreavisoForMonthResult =
  | { success: true; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

/**
 * Gera a escala de sobreaviso para o mês. Só permite gerar se o mês estiver limpo
 * (para regerar, é preciso limpar antes).
 */
export async function generateSobreavisoForMonth(
  month: number,
  year: number
): Promise<GenerateSobreavisoForMonthResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
  }

  const monthStart = startOfMonth(new Date(year, month - 1));
  const nextMonthStart = startOfMonth(new Date(year, month));

  const existingCount = await prisma.onCallAssignment.count({
    where: {
      startDate: { gte: monthStart, lt: nextMonthStart },
    },
  });
  if (existingCount > 0) {
    return {
      success: false,
      error: "Limpe o sobreaviso do mês antes de gerar novamente.",
    };
  }

  await prisma.schedule.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status: "OPEN" },
    update: {},
    select: { id: true },
  });

  try {
    await generateSobreavisoSchedule(month, year);
    const sobreavisoWeeks = await getSobreavisoScheduleForMonth(month, year);
    return { success: true, sobreavisoWeeks };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar sobreaviso.";
    return { success: false, error: message };
  }
}


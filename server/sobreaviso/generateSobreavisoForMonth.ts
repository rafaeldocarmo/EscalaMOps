"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSobreavisoSchedule } from "@/server/sobreaviso/generateSobreavisoSchedule";
import {
  getSobreavisoScheduleForMonth,
  type SobreavisoWeek,
} from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

export type GenerateSobreavisoForMonthResult =
  | { success: true; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

export async function generateSobreavisoForMonth(
  month: number,
  year: number
): Promise<GenerateSobreavisoForMonthResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado." };
  }

  // Ensures schedule exists (getSobreavisoScheduleForMonth expects schedule month/year in DB in some flows)
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


"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { format, startOfMonth } from "date-fns";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
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
  year: number,
  teamIdArg?: string | null
): Promise<GenerateSobreavisoForMonthResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) {
    return { success: false, error: "Acesso negado." };
  }

  let teamId: string;
  try {
    teamId = await resolveTeamIdForWriteForSession(session, teamIdArg);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Equipe não encontrada.";
    return { success: false, error: message };
  }

  const monthStart = startOfMonth(new Date(year, month - 1));
  const nextMonthStart = startOfMonth(new Date(year, month));
  const monthStartNoonUtc = new Date(format(monthStart, "yyyy-MM-dd") + "T12:00:00.000Z");
  const nextMonthStartNoonUtc = new Date(format(nextMonthStart, "yyyy-MM-dd") + "T12:00:00.000Z");

  const existingCount = await prisma.onCallAssignment.count({
    where: {
      startDate: { lt: nextMonthStartNoonUtc },
      endDate: { gt: monthStartNoonUtc },
      ...(teamId ? { member: { teamId } } : {}),
    },
  });
  if (existingCount > 0) {
    return {
      success: false,
      error: "Limpe o sobreaviso do mês antes de gerar novamente.",
    };
  }

  await prisma.schedule.upsert({
    where: { teamId_year_month: { teamId, year, month } },
    create: { teamId, year, month, status: "OPEN" },
    update: {},
    select: { id: true },
  });

  try {
    await generateSobreavisoSchedule(month, year, teamId);
    const sobreavisoWeeks = await getSobreavisoScheduleForMonth(month, year, teamIdArg);
    return { success: true, sobreavisoWeeks };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar sobreaviso.";
    return { success: false, error: message };
  }
}


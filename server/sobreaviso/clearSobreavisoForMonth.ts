"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { startOfMonth, format } from "date-fns";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import {
  getSobreavisoScheduleForMonth,
  type SobreavisoWeek,
} from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

export type ClearSobreavisoForMonthResult =
  | { success: true; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

export async function clearSobreavisoForMonth(
  month: number,
  year: number,
  teamIdArg?: string | null
): Promise<ClearSobreavisoForMonthResult> {
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

  await prisma.schedule.upsert({
    where: { teamId_year_month: { teamId, year, month } },
    create: { teamId, year, month, status: "OPEN" },
    update: {},
    select: { id: true },
  });

  try {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const nextMonthStart = startOfMonth(new Date(year, month));

    // Assignments são gravados com "T12:00:00.000Z". Alinhar a janela evita apagar o mês anterior
    // quando um assignment termina exatamente no começo do mês seguinte.
    const monthStartNoonUtc = new Date(format(monthStart, "yyyy-MM-dd") + "T12:00:00.000Z");
    const nextMonthStartNoonUtc = new Date(
      format(nextMonthStart, "yyyy-MM-dd") + "T12:00:00.000Z"
    );

    // Remove todos os períodos de sobreaviso que tocam o mês (a vista do mês fica vazia).
    // Isso inclui o período transversal (ex.: sexta anterior ao dia 1) que entra no mês.
    await prisma.onCallAssignment.deleteMany({
      where: {
        startDate: { lt: nextMonthStartNoonUtc },
        endDate: { gt: monthStartNoonUtc },
        ...(teamId ? { member: { teamId } } : {}),
      },
    });

    const sobreavisoWeeks = await getSobreavisoScheduleForMonth(month, year, teamIdArg);
    return { success: true, sobreavisoWeeks };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao limpar sobreaviso.";
    return { success: false, error: message };
  }
}


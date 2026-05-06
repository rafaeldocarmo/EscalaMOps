"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import { format, startOfMonth } from "date-fns";
import { z } from "zod";
import {
  getSobreavisoScheduleForMonth,
  type SobreavisoWeek,
} from "@/server/sobreaviso/getSobreavisoScheduleForMonth";

const saveSobreavisoEntrySchema = z.object({
  memberId: z.string().min(1),
  teamLevelId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const saveSobreavisoSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  entries: z.array(saveSobreavisoEntrySchema),
  teamId: z.string().min(1).optional(),
});

export type SaveSobreavisoForMonthResult =
  | { success: true; sobreavisoWeeks: SobreavisoWeek[] }
  | { success: false; error: string };

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export async function saveSobreavisoForMonth(input: {
  month: number;
  year: number;
  entries: Array<{ memberId: string; teamLevelId: string; date: string }>;
  teamId?: string | null;
}): Promise<SaveSobreavisoForMonthResult> {
  const parsed = saveSobreavisoSchema.safeParse({
    ...input,
    teamId: input.teamId ?? undefined,
  });
  if (!parsed.success) return { success: false, error: "Dados inválidos." };

  const session = await auth();
  if (!isStaffAdmin(session)) return { success: false, error: "Acesso negado." };

  let teamId: string;
  try {
    teamId = await resolveTeamIdForWriteForSession(session, parsed.data.teamId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Equipe não encontrada.";
    return { success: false, error: message };
  }

  const { month, year, entries } = parsed.data;
  const monthStart = startOfMonth(new Date(year, month - 1));
  const nextMonthStart = startOfMonth(new Date(year, month));
  const monthStartKey = toDateKey(monthStart);
  const nextMonthStartKey = toDateKey(nextMonthStart);
  const monthStartNoonUtc = new Date(monthStartKey + "T12:00:00.000Z");
  const nextMonthStartNoonUtc = new Date(nextMonthStartKey + "T12:00:00.000Z");

  const eligibleMembers = await prisma.teamMember.findMany({
    where: { teamId, sobreaviso: true },
    select: { id: true, teamLevelId: true },
  });
  const eligibleByMemberId = new Map(eligibleMembers.map((m) => [m.id, m] as const));

  const seenLevelDate = new Set<string>();
  for (const entry of entries) {
    if (entry.date < monthStartKey || entry.date >= nextMonthStartKey) {
      return { success: false, error: "Há datas fora do mês selecionado." };
    }
    const member = eligibleByMemberId.get(entry.memberId);
    if (!member) {
      return { success: false, error: "Há membro inválido no sobreaviso." };
    }
    if (member.teamLevelId !== entry.teamLevelId) {
      return { success: false, error: "Membro em nível inválido para sobreaviso." };
    }
    const levelDateKey = `${entry.teamLevelId}|${entry.date}`;
    if (seenLevelDate.has(levelDateKey)) {
      return {
        success: false,
        error: "Só é permitido um membro por nível em cada dia do sobreaviso.",
      };
    }
    seenLevelDate.add(levelDateKey);
  }

  const memberByLevelDate = new Map<string, string>();
  for (const entry of entries) {
    memberByLevelDate.set(`${entry.teamLevelId}|${entry.date}`, entry.memberId);
  }

  const teamLevelIds = [...new Set(eligibleMembers.map((m) => m.teamLevelId))];
  const createData: Array<{
    memberId: string;
    teamLevelId: string;
    startDate: Date;
    endDate: Date;
  }> = [];

  for (const teamLevelId of teamLevelIds) {
    let runMemberId: string | null = null;
    let runStart: Date | null = null;
    for (
      let cursor = new Date(monthStartNoonUtc);
      cursor < nextMonthStartNoonUtc;
      cursor = addDaysUtc(cursor, 1)
    ) {
      const dayKey = toDateKey(cursor);
      const currentMemberId = memberByLevelDate.get(`${teamLevelId}|${dayKey}`) ?? null;
      if (currentMemberId === runMemberId) continue;

      if (runMemberId && runStart) {
        createData.push({
          memberId: runMemberId,
          teamLevelId,
          startDate: new Date(runStart),
          endDate: new Date(cursor),
        });
      }
      runMemberId = currentMemberId;
      runStart = currentMemberId ? new Date(cursor) : null;
    }
    if (runMemberId && runStart) {
      createData.push({
        memberId: runMemberId,
        teamLevelId,
        startDate: new Date(runStart),
        endDate: new Date(nextMonthStartNoonUtc),
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.onCallAssignment.deleteMany({
      where: {
        startDate: { lt: nextMonthStartNoonUtc },
        endDate: { gt: monthStartNoonUtc },
        member: { teamId },
      },
    });
    if (createData.length > 0) {
      await tx.onCallAssignment.createMany({ data: createData });
    }
  });

  const sobreavisoWeeks = await getSobreavisoScheduleForMonth(month, year, teamId);
  return { success: true, sobreavisoWeeks };
}

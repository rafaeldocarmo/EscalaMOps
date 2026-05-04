"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";

export type PreviewOnCallSegment = {
  teamLevelId: string;
  levelLabel: string;
  memberId: string;
  memberName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (exclusive)
  intervalDays: number;
};

export type PreviewOnCallScheduleData = {
  teamId: string;
  year: number;
  month: number;
  members: { id: string; name: string; teamLevelId: string; levelLabel: string }[];
  segments: PreviewOnCallSegment[];
};

export type PreviewOnCallScheduleResult =
  | { success: true; data: PreviewOnCallScheduleData }
  | { success: false; error: string };

export async function previewOnCallSchedule(input: {
  year: number;
  month: number;
  teamId?: string | null;
  participantTeamLevelIds: string[];
  rotationIntervalDaysByLevel: Record<string, number>;
}): Promise<PreviewOnCallScheduleResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) return { success: false, error: "Acesso negado." };

  const resolvedTeamId = await resolveTeamIdForReadForSession(session, input.teamId);
  if (!resolvedTeamId) {
    return { success: false, error: "Nenhuma equipe encontrada para o contexto atual." };
  }

  try {
    assertStaffCanManageTeam(session, resolvedTeamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const year = Math.trunc(Number(input.year));
  const month = Math.trunc(Number(input.month));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { success: false, error: "Mês/ano inválidos." };
  }

  const rawParticipantIds = Array.isArray(input.participantTeamLevelIds)
    ? input.participantTeamLevelIds
    : [];
  const participantIds = Array.from(
    new Set(rawParticipantIds.map((x) => String(x).trim()).filter((x) => x.length > 0))
  );

  if (participantIds.length === 0) {
    return {
      success: true,
      data: { teamId: resolvedTeamId, year, month, members: [], segments: [] },
    };
  }

  const [levels, eligibleMembers] = await Promise.all([
    prisma.teamLevel.findMany({
      where: { teamId: resolvedTeamId, id: { in: participantIds } },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, sortOrder: true },
    }),
    prisma.teamMember.findMany({
      where: {
        teamId: resolvedTeamId,
        sobreaviso: true,
        teamLevelId: { in: participantIds },
      },
      select: {
        id: true,
        name: true,
        teamLevelId: true,
        onCallRotationIndex: true,
      },
    }),
  ]);

  const labelByLevelId = new Map(levels.map((l) => [l.id, l.label] as const));

  const members = [...eligibleMembers]
    .sort((a, b) => {
      const la = labelByLevelId.get(a.teamLevelId) ?? "";
      const lb = labelByLevelId.get(b.teamLevelId) ?? "";
      if (la !== lb) return la.localeCompare(lb, "pt-BR");
      return a.name.localeCompare(b.name, "pt-BR");
    })
    .map((m) => ({
      id: m.id,
      name: m.name,
      teamLevelId: m.teamLevelId,
      levelLabel: labelByLevelId.get(m.teamLevelId) ?? m.teamLevelId,
    }));

  type QueueMember = {
    id: string;
    name: string;
    teamLevelId: string;
    onCallRotationIndex: number;
  };

  const byLevel = new Map<string, QueueMember[]>();
  for (const m of eligibleMembers) {
    const arr = byLevel.get(m.teamLevelId) ?? [];
    arr.push({
      id: m.id,
      name: m.name,
      teamLevelId: m.teamLevelId,
      onCallRotationIndex: m.onCallRotationIndex,
    });
    byLevel.set(m.teamLevelId, arr);
  }

  for (const [levelId, arr] of byLevel) {
    arr.sort((a, b) => a.onCallRotationIndex - b.onCallRotationIndex);
    byLevel.set(levelId, arr);
  }

  const segments: PreviewOnCallSegment[] = [];
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, 12, 0, 0));

  function toKeyUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysUTC(d: Date, days: number): Date {
    return new Date(d.getTime() + days * 86400000);
  }

  for (const level of levels) {
    const queue = byLevel.get(level.id) ?? [];
    if (queue.length === 0) continue;

    const rawInterval = input.rotationIntervalDaysByLevel?.[level.id];
    const interval = Math.trunc(Number(rawInterval));
    const intervalDays = Number.isFinite(interval) && interval > 0 && interval <= 6 ? interval : 3;

    let cursor = new Date(monthStart);
    while (cursor < nextMonthStart) {
      const selected = queue[0]!;
      const maxIndex = Math.max(0, ...queue.map((m) => m.onCallRotationIndex));
      const newIndex = maxIndex + 1;
      selected.onCallRotationIndex = newIndex;
      queue.sort((a, b) => a.onCallRotationIndex - b.onCallRotationIndex);

      const end = addDaysUTC(cursor, intervalDays);
      const segEnd = end > nextMonthStart ? nextMonthStart : end;
      segments.push({
        teamLevelId: level.id,
        levelLabel: level.label,
        memberId: selected.id,
        memberName: selected.name,
        startDate: toKeyUTC(cursor),
        endDate: toKeyUTC(segEnd),
        intervalDays,
      });
      cursor = segEnd;
    }
  }

  segments.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return a.levelLabel.localeCompare(b.levelLabel, "pt-BR");
  });

  return {
    success: true,
    data: {
      teamId: resolvedTeamId,
      year,
      month,
      members,
      segments,
    },
  };
}


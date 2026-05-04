"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForReadForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import { ensureOnCallSettingsTable } from "@/server/sobreaviso/onCallSettingsTable";

export type OnCallSettingsRow = {
  participantTeamLevelIds: string[];
  rotationIntervalDaysByLevel: Record<string, number>;
};

export type OnCallSettingsForTeamData = {
  teamId: string;
  levels: { id: string; label: string; color: string; sortOrder: number }[];
  settings: OnCallSettingsRow;
};

export type GetOnCallSettingsForTeamResult =
  | { success: true; data: OnCallSettingsForTeamData }
  | { success: false; error: string };

export async function getOnCallSettingsForTeam(
  teamId?: string | null
): Promise<GetOnCallSettingsForTeamResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) return { success: false, error: "Acesso negado." };

  const resolvedTeamId = await resolveTeamIdForReadForSession(session, teamId);
  if (!resolvedTeamId) {
    return { success: false, error: "Nenhuma equipe encontrada para o contexto atual." };
  }

  try {
    assertStaffCanManageTeam(session, resolvedTeamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const levels = await prisma.teamLevel.findMany({
    where: { teamId: resolvedTeamId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, color: true, sortOrder: true },
  });

  await ensureOnCallSettingsTable();

  const rows = await prisma.$queryRaw<
    {
      participant_team_level_ids: string[];
      rotation_interval_days: number;
      rotation_interval_days_by_shift: unknown;
      rotation_interval_days_by_level: unknown;
    }[]
  >`SELECT participant_team_level_ids, rotation_interval_days, rotation_interval_days_by_shift, rotation_interval_days_by_level
    FROM team_on_call_settings
    WHERE team_id = ${resolvedTeamId}
    LIMIT 1`;

  const row = rows[0] ?? null;

  const participantTeamLevelIds =
    row?.participant_team_level_ids ?? levels.map((l) => l.id);

  const legacyDefaultRotation = row?.rotation_interval_days ?? 3;
  const rawByLevel = (row?.rotation_interval_days_by_level ?? {}) as Record<string, unknown>;
  const rotationIntervalDaysByLevel: Record<string, number> = {};

  const participantLevelIdSet = new Set(participantTeamLevelIds);
  for (const lvl of levels) {
    if (!participantLevelIdSet.has(lvl.id)) continue;
    const v = rawByLevel?.[lvl.id];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    rotationIntervalDaysByLevel[lvl.id] =
      Number.isFinite(n) && n > 0 && n <= 6 ? Math.trunc(n) : legacyDefaultRotation;
  }

  const settings: OnCallSettingsRow = {
    participantTeamLevelIds,
    rotationIntervalDaysByLevel,
  };

  return {
    success: true,
    data: {
      teamId: resolvedTeamId,
      levels,
      settings,
    },
  };
}


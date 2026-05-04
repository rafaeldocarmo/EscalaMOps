"use server";

import { prisma } from "@/lib/prisma";
import { ensureOnCallSettingsTable } from "@/server/sobreaviso/onCallSettingsTable";

export type TeamOnCallSettings = {
  participantTeamLevelIds: string[];
  rotationIntervalDaysByLevel: Record<string, number>;
  legacyDefaultRotationDays: number;
};

/**
 * Loads persisted on-call settings for a team (or defaults).
 *
 * Defaults:
 * - participantTeamLevelIds: all team levels
 * - rotationIntervalDaysByLevel: default 3 for each participant level
 */
export async function loadOnCallSettings(teamId: string): Promise<TeamOnCallSettings> {
  await ensureOnCallSettingsTable();

  const levels = await prisma.teamLevel.findMany({
    where: { teamId },
    select: { id: true },
  });
  const allLevelIds = levels.map((l) => l.id);

  const rows = await prisma.$queryRaw<
    {
      participant_team_level_ids: string[];
      rotation_interval_days: number;
      rotation_interval_days_by_level: unknown;
    }[]
  >`SELECT participant_team_level_ids, rotation_interval_days, rotation_interval_days_by_level
    FROM team_on_call_settings
    WHERE team_id = ${teamId}
    LIMIT 1`;

  const row = rows[0] ?? null;
  const participantTeamLevelIds =
    row?.participant_team_level_ids?.filter((id) => allLevelIds.includes(id)) ?? allLevelIds;

  const legacyDefaultRotationDays = row?.rotation_interval_days ?? 3;
  const rawByLevel = (row?.rotation_interval_days_by_level ?? {}) as Record<string, unknown>;
  const rotationIntervalDaysByLevel: Record<string, number> = {};

  for (const id of participantTeamLevelIds) {
    const v = rawByLevel?.[id];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    rotationIntervalDaysByLevel[id] =
      Number.isFinite(n) && n > 0 && n <= 6 ? Math.trunc(n) : legacyDefaultRotationDays;
  }

  return { participantTeamLevelIds, rotationIntervalDaysByLevel, legacyDefaultRotationDays };
}


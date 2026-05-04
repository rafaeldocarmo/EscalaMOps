"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveTeamIdForWriteForSession } from "@/lib/multiTeam";
import { assertStaffCanManageTeam } from "@/server/team/assertStaffCanManageTeam";
import { ensureOnCallSettingsTable } from "@/server/sobreaviso/onCallSettingsTable";

export type SaveOnCallSettingsInput = {
  participantTeamLevelIds: string[];
  rotationIntervalDaysByLevel: Record<string, number>;
};

export type SaveOnCallSettingsResult =
  | { success: true }
  | { success: false; error: string };

export async function saveOnCallSettingsForTeam(
  input: SaveOnCallSettingsInput,
  teamId?: string | null
): Promise<SaveOnCallSettingsResult> {
  const session = await auth();
  if (!isStaffAdmin(session)) return { success: false, error: "Acesso negado." };

  const resolvedTeamId = await resolveTeamIdForWriteForSession(session, teamId);

  try {
    assertStaffCanManageTeam(session, resolvedTeamId);
  } catch {
    return { success: false, error: "Acesso negado." };
  }

  const rawIds = Array.isArray(input.participantTeamLevelIds)
    ? input.participantTeamLevelIds
    : [];
  const participantIds = Array.from(
    new Set(rawIds.map((x) => String(x).trim()).filter((x) => x.length > 0))
  );

  // Validate participant IDs belong to the team (ignore unknown IDs).
  const allowed = await prisma.teamLevel.findMany({
    where: { teamId: resolvedTeamId },
    select: { id: true },
  });
  const allowedSet = new Set(allowed.map((l) => l.id));
  const filtered = participantIds.filter((id) => allowedSet.has(id));

  const rawByLevel =
    input.rotationIntervalDaysByLevel && typeof input.rotationIntervalDaysByLevel === "object"
      ? input.rotationIntervalDaysByLevel
      : {};

  const rotationIntervalDaysByLevel: Record<string, number> = {};
  for (const [levelId, v] of Object.entries(rawByLevel)) {
    if (!allowedSet.has(levelId)) continue;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n) || n <= 0 || n > 6) {
      return { success: false, error: "O intervalo de dias deve ser maior que 0 e menor ou igual a 6." };
    }
    rotationIntervalDaysByLevel[levelId] = n;
  }

  // Se nenhum nível participa, não exigimos mapa de rotação por nível.
  // Se há níveis participantes, garantimos um valor default (3) para todos os níveis participantes.
  if (filtered.length > 0) {
    for (const levelId of filtered) {
      if (!rotationIntervalDaysByLevel[levelId]) rotationIntervalDaysByLevel[levelId] = 3;
    }
  }

  await ensureOnCallSettingsTable();

  await prisma.$executeRaw`
    INSERT INTO team_on_call_settings (
      team_id,
      participant_team_level_ids,
      rotation_interval_days,
      rotation_interval_days_by_level
    )
    VALUES (${resolvedTeamId}, ${filtered}::text[], 3, ${rotationIntervalDaysByLevel}::jsonb)
    ON CONFLICT (team_id)
    DO UPDATE SET
      participant_team_level_ids = EXCLUDED.participant_team_level_ids,
      rotation_interval_days_by_level = EXCLUDED.rotation_interval_days_by_level
  `;

  return { success: true };
}


/**
 * Snapshot do catálogo consumido pelo formulário de membros.
 * Formato bate com `getTeamLevelShiftCatalog().data` (para não forçar import de server).
 */
export type TeamCatalogSnapshot = {
  levels: { id: string; label: string; color: string; sortOrder: number }[];
  shifts: { id: string; label: string; color: string; sortOrder: number }[];
  allowedPairs: { teamLevelId: string; teamShiftId: string }[];
};

export type CatalogLevelOption = {
  id: string;
  label: string;
  color: string;
};

export type CatalogShiftOption = {
  id: string;
  label: string;
  color: string;
};

export type MemberFormCatalog = {
  /** Todos os níveis do catálogo, ordenados. */
  levels: CatalogLevelOption[];
  /** Todos os turnos do catálogo, ordenados. */
  shifts: CatalogShiftOption[];
  /** Chave "teamLevelId::teamShiftId" para lookup da matriz. */
  allowedPairKeys: Set<string>;
};

function pairKey(teamLevelId: string, teamShiftId: string) {
  return `${teamLevelId}::${teamShiftId}`;
}

/** Monta o snapshot do formulário a partir do catálogo da equipe. */
export function buildMemberFormCatalog(data: TeamCatalogSnapshot): MemberFormCatalog | null {
  if (data.levels.length === 0 || data.shifts.length === 0) return null;

  const levels: CatalogLevelOption[] = [...data.levels]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((r) => ({ id: r.id, label: r.label.trim(), color: r.color }));

  const shifts: CatalogShiftOption[] = [...data.shifts]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((r) => ({ id: r.id, label: r.label.trim(), color: r.color }));

  const allowedPairKeys = new Set<string>();
  for (const p of data.allowedPairs) {
    allowedPairKeys.add(pairKey(p.teamLevelId, p.teamShiftId));
  }

  return { levels, shifts, allowedPairKeys };
}

export function shiftsAllowedForLevel(
  c: MemberFormCatalog,
  teamLevelId: string,
): CatalogShiftOption[] {
  return c.shifts.filter((s) => c.allowedPairKeys.has(pairKey(teamLevelId, s.id)));
}

export function isPairAllowedInCatalog(
  c: MemberFormCatalog,
  teamLevelId: string,
  teamShiftId: string,
): boolean {
  return c.allowedPairKeys.has(pairKey(teamLevelId, teamShiftId));
}

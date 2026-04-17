import type { Level, Shift } from "@/types/team";

/**
 * Snapshot do catálogo consumido pelo formulário de membros.
 * Formato bate com `getTeamLevelShiftCatalog().data` (para não forçar import de server).
 */
export type TeamCatalogSnapshot = {
  levels: { id: string; label: string; legacyKind: Level | null; sortOrder: number }[];
  shifts: { id: string; label: string; legacyKind: Shift | null; sortOrder: number }[];
  allowedPairs: { teamLevelId: string; teamShiftId: string }[];
};

export type CatalogLevelOption = {
  id: string;
  label: string;
  legacyKind: Level | null;
};

export type CatalogShiftOption = {
  id: string;
  label: string;
  legacyKind: Shift | null;
};

export type MemberFormCatalog = {
  /** Todos os níveis do catálogo (inclui custom), ordenados. */
  levels: CatalogLevelOption[];
  /** Todos os turnos do catálogo (inclui custom), ordenados. */
  shifts: CatalogShiftOption[];
  /** Chave "teamLevelId::teamShiftId" para lookup da matriz. */
  allowedPairKeys: Set<string>;
};

function pairKey(teamLevelId: string, teamShiftId: string) {
  return `${teamLevelId}::${teamShiftId}`;
}

/**
 * Monta o snapshot do formulário a partir do catálogo da equipe.
 *
 * Inclui TODAS as entradas do catálogo — inclusive as personalizadas
 * (`legacyKind = NULL`). O formulário decide exibir avisos e desabilitar
 * sobreaviso/participação na escala quando o usuário escolhe uma opção custom.
 */
export function buildMemberFormCatalog(data: TeamCatalogSnapshot): MemberFormCatalog | null {
  if (data.levels.length === 0 || data.shifts.length === 0) return null;

  const levels: CatalogLevelOption[] = [...data.levels]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((r) => ({ id: r.id, label: r.label.trim(), legacyKind: r.legacyKind }));

  const shifts: CatalogShiftOption[] = [...data.shifts]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((r) => ({ id: r.id, label: r.label.trim(), legacyKind: r.legacyKind }));

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

/** True se o nível/turno for personalizado (fora das regras legadas). */
export function isCustomLevel(level: Pick<CatalogLevelOption, "legacyKind">): boolean {
  return level.legacyKind == null;
}

export function isCustomShift(shift: Pick<CatalogShiftOption, "legacyKind">): boolean {
  return shift.legacyKind == null;
}

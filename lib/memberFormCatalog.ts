import { catalogLabelToMemberLevel, catalogLabelToMemberShift } from "@/lib/teamCatalogLabelMapping";
import type { Level, Shift } from "@/types/team";

/** Mesmo formato retornado por `getTeamLevelShiftCatalog`.data (sem import de server). */
export type TeamCatalogSnapshot = {
  levels: { id: string; label: string; sortOrder: number }[];
  shifts: { id: string; label: string; sortOrder: number }[];
  allowedPairs: { teamLevelId: string; teamShiftId: string }[];
};

export type MemberFormCatalog = {
  /** Níveis com label igual a um enum, na ordem do catálogo */
  levels: Level[];
  /** Turnos com label igual a um enum, na ordem do catálogo */
  orderedShifts: Shift[];
  /** Pares permitidos pela matriz (nível/turno = enum) */
  allowedPairKeys: Set<string>;
  /** Texto exibido nos selects (nome configurado no catálogo) */
  levelLabels: Partial<Record<Level, string>>;
  shiftLabels: Partial<Record<Shift, string>>;
};

function pairKey(level: Level, shift: Shift) {
  return `${level}:${shift}`;
}

/**
 * Quando a equipe tem ao menos um nível e um turno no catálogo, o formulário de membros
 * pode restringir escolhas ao catálogo e à matriz — alinhado a `validateMemberLevelShiftForTeam`.
 */
export function buildMemberFormCatalog(data: TeamCatalogSnapshot): MemberFormCatalog | null {
  if (data.levels.length === 0 || data.shifts.length === 0) return null;

  const levelsSorted = [...data.levels].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
  const levels: Level[] = [];
  const levelLabels: Partial<Record<Level, string>> = {};
  for (const row of levelsSorted) {
    const L = catalogLabelToMemberLevel(row.label);
    if (L && !levels.includes(L)) {
      levels.push(L);
      levelLabels[L] = row.label.trim();
    }
  }

  const shiftsSorted = [...data.shifts].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
  const orderedShifts: Shift[] = [];
  const shiftLabels: Partial<Record<Shift, string>> = {};
  for (const row of shiftsSorted) {
    const S = catalogLabelToMemberShift(row.label);
    if (S && !orderedShifts.includes(S)) {
      orderedShifts.push(S);
      shiftLabels[S] = row.label.trim();
    }
  }

  // Nada mapeou para enum — membro continua só com níveis/turnos fixos do sistema
  if (levels.length === 0 || orderedShifts.length === 0) return null;

  const levelById = new Map(data.levels.map((r) => [r.id, r]));
  const shiftById = new Map(data.shifts.map((r) => [r.id, r]));

  const allowedPairKeys = new Set<string>();
  for (const p of data.allowedPairs) {
    const lr = levelById.get(p.teamLevelId);
    const sr = shiftById.get(p.teamShiftId);
    if (!lr || !sr) continue;
    const L = catalogLabelToMemberLevel(lr.label);
    const S = catalogLabelToMemberShift(sr.label);
    if (L && S) allowedPairKeys.add(pairKey(L, S));
  }

  return { levels, orderedShifts, allowedPairKeys, levelLabels, shiftLabels };
}

export function shiftsAllowedForLevel(c: MemberFormCatalog, level: Level): Shift[] {
  return c.orderedShifts.filter((s) => c.allowedPairKeys.has(pairKey(level, s)));
}

export function isPairAllowedInCatalog(c: MemberFormCatalog, level: Level, shift: Shift): boolean {
  return c.allowedPairKeys.has(pairKey(level, shift));
}

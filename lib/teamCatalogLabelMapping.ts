import type { Level, Shift } from "@/types/team";
import { LEVEL_OPTIONS, SHIFT_OPTIONS } from "@/types/team";

const LEVEL_ENUMS = new Set<Level>(["N1", "N2", "ESPC", "PRODUCAO"]);
const SHIFT_ENUMS = new Set<Shift>(["T1", "T2", "T3", "TC"]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Compara rótulos de catálogo de forma tolerante (acentos, caixa). */
function labelKey(s: string): string {
  return stripDiacritics(s.trim()).toLowerCase();
}

function buildLevelLookup(): Map<string, Level> {
  const m = new Map<string, Level>();
  for (const o of LEVEL_OPTIONS) {
    m.set(labelKey(o.value), o.value);
    m.set(labelKey(o.label), o.value);
  }
  return m;
}

function buildShiftLookup(): Map<string, Shift> {
  const m = new Map<string, Shift>();
  for (const o of SHIFT_OPTIONS) {
    m.set(labelKey(o.value), o.value);
    m.set(labelKey(o.label), o.value);
  }
  return m;
}

const LEVEL_BY_LABEL_KEY = buildLevelLookup();
const SHIFT_BY_LABEL_KEY = buildShiftLookup();

/**
 * Converte o nome exibido no catálogo (TeamLevel.label) para o enum armazenado em TeamMember.level.
 */
export function catalogLabelToMemberLevel(label: string): Level | null {
  const t = label.trim();
  if (!t) return null;
  if (LEVEL_ENUMS.has(t as Level)) return t as Level;
  const up = t.toUpperCase();
  if (LEVEL_ENUMS.has(up as Level)) return up as Level;
  const byKey = LEVEL_BY_LABEL_KEY.get(labelKey(t));
  return byKey ?? null;
}

/**
 * Converte o nome exibido no catálogo (TeamShift.label) para o enum armazenado em TeamMember.shift.
 */
export function catalogLabelToMemberShift(label: string): Shift | null {
  const t = label.trim();
  if (!t) return null;
  if (SHIFT_ENUMS.has(t as Shift)) return t as Shift;
  const up = t.toUpperCase();
  if (SHIFT_ENUMS.has(up as Shift)) return up as Shift;
  const byKey = SHIFT_BY_LABEL_KEY.get(labelKey(t));
  return byKey ?? null;
}

import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
import type { Level, Shift } from "@/types/team";
import { displayLabelForLevel, displayLabelForShift } from "@/types/team";

/**
 * Escala legada opera sobre enums Level/Shift. Estas funções filtram o catálogo
 * para exibir apenas entradas com `legacyKind` definido (os demais níveis/turnos
 * — "personalizados" — ficam fora da escala até serem parametrizados).
 */

export function initialScheduleLevelFilter(catalog: MemberFormCatalog | null): Level[] {
  if (!catalog) return [];
  const uniq: Level[] = [];
  for (const l of catalog.levels) {
    if (l.legacyKind && !uniq.includes(l.legacyKind)) uniq.push(l.legacyKind);
  }
  return uniq;
}

export function initialScheduleShiftFilter(catalog: MemberFormCatalog | null): Shift[] {
  if (!catalog) return [];
  const uniq: Shift[] = [];
  for (const s of catalog.shifts) {
    if (s.legacyKind && !uniq.includes(s.legacyKind)) uniq.push(s.legacyKind);
  }
  return uniq;
}

export function levelOptionsForScheduleFilters(
  catalog: MemberFormCatalog | null,
): { value: Level; label: string }[] {
  if (!catalog) return [];
  const result: { value: Level; label: string }[] = [];
  for (const l of catalog.levels) {
    if (!l.legacyKind) continue;
    if (result.some((r) => r.value === l.legacyKind)) continue;
    result.push({ value: l.legacyKind, label: l.label || displayLabelForLevel(l.legacyKind) });
  }
  return result;
}

export function shiftOptionsForScheduleFilters(
  catalog: MemberFormCatalog | null,
): { value: Shift; label: string }[] {
  if (!catalog) return [];
  const result: { value: Shift; label: string }[] = [];
  for (const s of catalog.shifts) {
    if (!s.legacyKind) continue;
    if (result.some((r) => r.value === s.legacyKind)) continue;
    result.push({ value: s.legacyKind, label: s.label || displayLabelForShift(s.legacyKind) });
  }
  return result;
}

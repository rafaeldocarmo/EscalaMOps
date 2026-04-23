import type { MemberFormCatalog } from "@/lib/memberFormCatalog";

/**
 * Filtros de nível/turno da escala mensal.
 *
 * Os valores dos filtros são IDs do catálogo (teamLevelId / teamShiftId), o que
 * garante suporte tanto a entradas legadas (legacyKind≠null) quanto a entradas
 * personalizadas (legacyKind=null).
 */

/** IDs de todos os teamLevels disponíveis no catálogo. Filtro inicial = "mostrar todos". */
export function initialScheduleLevelFilter(catalog: MemberFormCatalog | null): string[] {
  if (!catalog) return [];
  return catalog.levels.map((l) => l.id);
}

/** IDs de todos os teamShifts disponíveis no catálogo. Filtro inicial = "mostrar todos". */
export function initialScheduleShiftFilter(catalog: MemberFormCatalog | null): string[] {
  if (!catalog) return [];
  return catalog.shifts.map((s) => s.id);
}

/** Opções para o MultiSelect de nível: value = teamLevelId, label = label do catálogo. */
export function levelOptionsForScheduleFilters(
  catalog: MemberFormCatalog | null,
): { value: string; label: string }[] {
  if (!catalog) return [];
  return catalog.levels.map((l) => ({ value: l.id, label: l.label }));
}

/** Opções para o MultiSelect de turno: value = teamShiftId, label = label do catálogo. */
export function shiftOptionsForScheduleFilters(
  catalog: MemberFormCatalog | null,
): { value: string; label: string }[] {
  if (!catalog) return [];
  return catalog.shifts.map((s) => ({ value: s.id, label: s.label }));
}

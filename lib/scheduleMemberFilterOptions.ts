import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
import type { Level, Shift } from "@/types/team";
import { displayLabelForLevel, displayLabelForShift } from "@/types/team";

export function initialScheduleLevelFilter(catalog: MemberFormCatalog | null): Level[] {
  if (catalog?.levels.length) return [...catalog.levels];
  return [];
}

export function initialScheduleShiftFilter(catalog: MemberFormCatalog | null): Shift[] {
  if (catalog?.orderedShifts.length) return [...catalog.orderedShifts];
  return [];
}

export function levelOptionsForScheduleFilters(
  catalog: MemberFormCatalog | null,
): { value: Level; label: string }[] {
  if (!catalog) {
    return [];
  }
  return catalog.levels.map((v) => ({
    value: v,
    label: catalog.levelLabels[v] ?? displayLabelForLevel(v),
  }));
}

export function shiftOptionsForScheduleFilters(
  catalog: MemberFormCatalog | null,
): { value: Shift; label: string }[] {
  if (!catalog) {
    return [];
  }
  return catalog.orderedShifts.map((v) => ({
    value: v,
    label: catalog.shiftLabels[v] ?? displayLabelForShift(v),
  }));
}

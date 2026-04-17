// Client-safe team types (no Prisma import)

export type Level = "N1" | "N2" | "ESPC" | "PRODUCAO";
export type Shift = "T1" | "T2" | "T3" | "TC";

export interface TeamMemberRow {
  id: string;
  name: string;
  phone: string;
  level: Level;
  shift: Shift;
  sobreaviso: boolean;
  participatesInSchedule: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "N1", label: "N1" },
  { value: "N2", label: "N2" },
  { value: "ESPC", label: "ESPC" },
  { value: "PRODUCAO", label: "Produção" },
];

export const SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: "T1", label: "T1" },
  { value: "T2", label: "T2" },
  { value: "T3", label: "T3" },
  { value: "TC", label: "TC" },
];

/** Rótulo amigável para o enum (ex.: em tabelas quando não há catálogo com label custom). */
export function displayLabelForLevel(level: Level): string {
  return LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? level;
}

export function displayLabelForShift(shift: Shift): string {
  return SHIFT_OPTIONS.find((o) => o.value === shift)?.label ?? shift;
}

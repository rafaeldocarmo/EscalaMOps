// Client-safe team types (no Prisma import)

export type Level = "N1" | "N2" | "ESPC" | "PRODUCAO";
export type Shift = "T1" | "T2" | "T3" | "TC";

export interface TeamMemberRow {
  id: string;
  name: string;
  phone: string;
  /** FK para TeamLevel — fonte de verdade do nível do membro. */
  teamLevelId: string;
  /** FK para TeamShift — fonte de verdade do turno do membro. */
  teamShiftId: string;
  /** Label exibido (vem do catálogo). */
  levelLabel: string;
  shiftLabel: string;
  /** Enum legado derivado de TeamLevel.legacyKind. NULL quando é personalizado. */
  levelLegacyKind: Level | null;
  shiftLegacyKind: Shift | null;
  /**
   * @deprecated Use `levelLegacyKind` + `levelLabel`. Mantido para consumidores legados;
   * NULL para membros com catálogo personalizado (fora das regras de escala/sobreaviso).
   */
  level: Level | null;
  /** @deprecated Use `shiftLegacyKind` + `shiftLabel`. */
  shift: Shift | null;
  /** True se level ou shift é personalizado (fora das regras legadas). */
  isCustom: boolean;
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

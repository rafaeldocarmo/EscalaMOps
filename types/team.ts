// Client-safe team types (no Prisma import)

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
  sobreaviso: boolean;
  participatesInSchedule: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  /** Posição na fila de rotação do grupo (turno × nível); menor = mais à frente. */
  rotationIndex: number;
  /**
   * Se `true`, o membro entra no rodízio de fim de semana (regra `WEEKEND_COVERAGE` com count > 0).
   * Membros com `false` costumam folgar todo FDS e não competem pelas vagas de FDS.
   */
  weekendRotation: boolean;
  sobreaviso: boolean;
  participatesInSchedule: boolean;
  createdAt: Date;
  updatedAt: Date;
}

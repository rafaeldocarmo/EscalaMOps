/**
 * Gerenciamento da fila de rotação de fim de semana.
 *
 * A chave de agrupamento é o par (teamShiftId, teamLevelId) do catálogo da
 * equipe. As constantes `WEEKEND_COVERAGE` / `WEEKEND_GROUPS` que existiam
 * aqui foram substituídas por `ScheduleRule` (kind=WEEKEND_COVERAGE),
 * consultadas via `resolveScheduleRules`.
 */
export interface QueueMember {
  id: string;
  name: string;
  teamShiftId: string;
  teamLevelId: string;
  rotationIndex: number;
}

/** Chave interna estável para um grupo (shift, level). */
export function groupKey(teamShiftId: string, teamLevelId: string): string {
  return `${teamShiftId}|${teamLevelId}`;
}

/**
 * Retorna a fila do grupo (shift, level) ordenada por rotationIndex ascendente
 * (quem tem índice menor é o próximo a trabalhar).
 */
export function getQueueOrder(
  members: QueueMember[],
  teamShiftId: string,
  teamLevelId: string
): QueueMember[] {
  return members
    .filter((m) => m.teamShiftId === teamShiftId && m.teamLevelId === teamLevelId)
    .sort((a, b) => a.rotationIndex - b.rotationIndex);
}

/**
 * Seleciona os próximos `count` membros do início da fila e retorna:
 * - `selected`: os escolhidos;
 * - `updates`: novos `rotationIndex` para mover os escolhidos para o fim da fila.
 */
export function selectAndAdvanceQueue(
  queue: QueueMember[],
  count: number
): { selected: QueueMember[]; updates: { memberId: string; newRotationIndex: number }[] } {
  if (count <= 0 || queue.length === 0) {
    return { selected: [], updates: [] };
  }
  const take = Math.min(count, queue.length);
  const selected = queue.slice(0, take);
  const maxIndex = Math.max(0, ...queue.map((m) => m.rotationIndex));
  const updates: { memberId: string; newRotationIndex: number }[] = [];
  selected.forEach((m, i) => {
    updates.push({ memberId: m.id, newRotationIndex: maxIndex + 1 + i });
  });
  return { selected, updates };
}

/**
 * Conjunto único de pares (shiftId, levelId) presentes nos membros. Útil para
 * iterar os grupos de rotação sem depender de uma lista pré-definida.
 */
export function listMemberGroups(
  members: QueueMember[]
): { teamShiftId: string; teamLevelId: string }[] {
  const seen = new Set<string>();
  const out: { teamShiftId: string; teamLevelId: string }[] = [];
  for (const m of members) {
    const k = groupKey(m.teamShiftId, m.teamLevelId);
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ teamShiftId: m.teamShiftId, teamLevelId: m.teamLevelId });
    }
  }
  return out;
}

import {
  getQueueOrder,
  listMemberGroups,
  selectAndAdvanceQueue,
  type QueueMember,
} from "./queueManager";
import { getWeekendCoverageCount, type ResolvedRuleSet } from "./resolveScheduleRules";

export interface WeekendSelectionResult {
  weekendWorkerIds: Set<string>;
  queueUpdates: { memberId: string; newRotationIndex: number }[];
}

/**
 * Para um fim de semana (sábado+domingo), seleciona os trabalhadores de cada
 * grupo (teamShiftId × teamLevelId) presente na lista de membros, respeitando
 * a quantidade definida em `ResolvedRuleSet.weekendCoverage`.
 *
 * As mesmas pessoas trabalham sábado e domingo. Grupos sem regra ou com
 * `count=0` ficam todos em OFF no fim de semana.
 */
export function selectWeekendWorkers(
  members: QueueMember[],
  _saturday: Date,
  _sunday: Date,
  resolved: ResolvedRuleSet
): WeekendSelectionResult {
  const weekendWorkerIds = new Set<string>();
  const seenUpdates = new Map<string, number>();

  for (const { teamShiftId, teamLevelId } of listMemberGroups(members)) {
    const count = getWeekendCoverageCount(resolved, teamShiftId, teamLevelId);
    if (count <= 0) continue;

    const queue = getQueueOrder(members, teamShiftId, teamLevelId);
    const { selected, updates } = selectAndAdvanceQueue(queue, count);

    for (const m of selected) {
      weekendWorkerIds.add(m.id);
    }
    for (const u of updates) {
      const existing = seenUpdates.get(u.memberId);
      if (existing === undefined || u.newRotationIndex > existing) {
        seenUpdates.set(u.memberId, u.newRotationIndex);
      }
    }
  }

  const queueUpdates: { memberId: string; newRotationIndex: number }[] = [];
  for (const [memberId, newRotationIndex] of seenUpdates) {
    queueUpdates.push({ memberId, newRotationIndex });
  }

  return { weekendWorkerIds, queueUpdates };
}

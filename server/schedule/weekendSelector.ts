import type { QueueMember } from "./queueManager";
import {
  WEEKEND_GROUPS,
  WEEKEND_COVERAGE,
  getQueueOrder,
  selectAndAdvanceQueue,
} from "./queueManager";

export interface WeekendSelectionResult {
  weekendWorkerIds: Set<string>;
  queueUpdates: { memberId: string; newRotationIndex: number }[];
}

/**
 * For a given weekend (Saturday and Sunday dates), select employees from each queue
 * according to WEEKEND_COVERAGE. Same employees work both days.
 * Returns the set of member IDs who work the weekend and queue updates (move to end).
 */
export function selectWeekendWorkers(
  members: QueueMember[],
  saturday: Date,
  sunday: Date
): WeekendSelectionResult {
  const weekendWorkerIds = new Set<string>();
  const allQueueUpdates: { memberId: string; newRotationIndex: number }[] = [];
  const seenUpdates = new Map<string, number>();

  for (const groupKey of WEEKEND_GROUPS) {
    const count = WEEKEND_COVERAGE[groupKey];
    if (count === 0) continue;

    const queue = getQueueOrder(members, groupKey);
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

  for (const [memberId, newRotationIndex] of seenUpdates) {
    allQueueUpdates.push({ memberId, newRotationIndex });
  }

  return { weekendWorkerIds, queueUpdates: allQueueUpdates };
}

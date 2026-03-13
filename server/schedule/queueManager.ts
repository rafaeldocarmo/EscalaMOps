import type { Level, Shift } from "@/lib/generated/prisma/enums";

export interface QueueMember {
  id: string;
  name: string;
  shift: Shift;
  level: Level;
  rotationIndex: number;
}

export type GroupKey = `${Shift}_${Level}`;

export const WEEKEND_COVERAGE: Record<GroupKey, number> = {
  T1_N1: 1,
  T1_N2: 2,
  T1_ESPC: 0,
  T2_N1: 1,
  T2_N2: 2,
  T2_ESPC: 0,
  T3_N1: 1,
  T3_N2: 0,
  T3_ESPC: 0,
  TC_N1: 0,
  TC_N2: 0,
  TC_ESPC: 0,
};

/** Groups that participate in weekend rotation. */
export const WEEKEND_GROUPS: GroupKey[] = [
  "T1_N1",
  "T1_N2",
  "T2_N1",
  "T2_N2",
  "T3_N1",
];

export function toGroupKey(shift: Shift, level: Level): GroupKey {
  return `${shift}_${level}`;
}

/** Get queue order for a group: sorted by rotationIndex ascending (lower = next in line). */
export function getQueueOrder(members: QueueMember[], groupKey: GroupKey): QueueMember[] {
  const [shift, level] = groupKey.split("_") as [Shift, Level];
  return members
    .filter((m) => m.shift === shift && m.level === level)
    .sort((a, b) => a.rotationIndex - b.rotationIndex);
}

/**
 * Select the next `count` members from the front of the queue.
 * Returns selected members and the updated list (selected moved to end with new indices).
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

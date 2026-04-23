"use server";

import { auth } from "@/auth";
import { getMemberScheduleForSwapPreview } from "@/server/schedule/getSchedule";

export type FullSwapPreviewMonth = {
  year: number;
  month: number;
  days: { dateKey: string; status: "WORK" | "OFF" }[];
};

/**
 * Returns "your schedule after swap" = the other member's current schedule (current + next month).
 * So your working weekends go to them, theirs to you; weekday offs are swapped too.
 */
export async function getFullQueueSwapPreview(
  swapWithMemberId: string
): Promise<FullSwapPreviewMonth[] | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;
  if (session.member.id === swapWithMemberId) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const [month1, month2] = await Promise.all([
    getMemberScheduleForSwapPreview(swapWithMemberId, currentYear, currentMonth),
    getMemberScheduleForSwapPreview(swapWithMemberId, nextYear, nextMonth),
  ]);

  const result: FullSwapPreviewMonth[] = [];
  if (month1) {
    result.push({
      year: month1.year,
      month: month1.month,
      days: month1.days.map((d) => ({ dateKey: d.dateKey, status: d.status })),
    });
  }
  if (month2) {
    result.push({
      year: month2.year,
      month: month2.month,
      days: month2.days.map((d) => ({ dateKey: d.dateKey, status: d.status })),
    });
  }
  return result.length > 0 ? result : null;
}

// --- Legacy weekend-only preview (kept for backwards compatibility; prefer getFullQueueSwapPreview) ---
import { prisma } from "@/lib/prisma";
import { addDays, nextSaturday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { QueueMember } from "@/server/schedule/queueManager";
import { selectWeekendWorkers } from "@/server/schedule/weekendSelector";
import { resolveScheduleRules } from "@/server/schedule/resolveScheduleRules";

export type WeekendPreviewItem = {
  weekendLabel: string;
  saturday: string;
  sunday: string;
  saturdayDateKey: string;
  sundayDateKey: string;
  currentUserWorks: boolean;
  afterSwapUserWorks: boolean;
};

/**
 * Returns preview of next N weekends: whether current user works now and after swapping with swapWithMemberId.
 */
export async function getWeekendSwapPreview(
  swapWithMemberId: string
): Promise<WeekendPreviewItem[] | null> {
  const session = await auth();
  if (!session?.user || !session.member) return null;

  const memberId = session.member.id;
  if (memberId === swapWithMemberId) return null;

  const selfMember = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      teamId: true,
      teamShiftId: true,
      teamLevelId: true,
      participatesInSchedule: true,
    },
  });
  if (!selfMember || !selfMember.teamId || !selfMember.participatesInSchedule) return null;

  const allMembers = await prisma.teamMember.findMany({
    where: {
      teamId: selfMember.teamId,
      teamShiftId: selfMember.teamShiftId,
      teamLevelId: selfMember.teamLevelId,
      participatesInSchedule: true,
    },
    select: {
      id: true,
      name: true,
      teamShiftId: true,
      teamLevelId: true,
      rotationIndex: true,
    },
  });

  const groupMembers: QueueMember[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    teamShiftId: m.teamShiftId,
    teamLevelId: m.teamLevelId,
    rotationIndex: m.rotationIndex,
  }));

  const other = groupMembers.find((m) => m.id === swapWithMemberId);
  if (!other) return null;

  const resolved = await resolveScheduleRules(selfMember.teamId);

  const applyUpdates = (
    members: QueueMember[],
    updates: { memberId: string; newRotationIndex: number }[]
  ): QueueMember[] => {
    const byId = new Map(members.map((m) => [m.id, { ...m }]));
    for (const u of updates) {
      const m = byId.get(u.memberId);
      if (m) byId.set(u.memberId, { ...m, rotationIndex: u.newRotationIndex });
    }
    return Array.from(byId.values());
  };

  const runSimulation = (
    initialMembers: QueueMember[],
    numWeekends: number
  ): { userWorks: boolean[] } => {
    let state = initialMembers.map((m) => ({ ...m }));
    const userWorks: boolean[] = [];
    let sat = nextSaturday(new Date());
    for (let i = 0; i < numWeekends; i++) {
      const sun = addDays(sat, 1);
      const result = selectWeekendWorkers(state, sat, sun, resolved);
      userWorks.push(result.weekendWorkerIds.has(memberId));
      state = applyUpdates(state, result.queueUpdates);
      sat = addDays(sat, 7);
    }
    return { userWorks };
  };

  const numWeekends = 6;
  const currentRun = runSimulation(groupMembers, numWeekends);

  const swappedMembers: QueueMember[] = groupMembers.map((m) => {
    if (m.id === memberId) return { ...m, rotationIndex: other.rotationIndex };
    if (m.id === swapWithMemberId) return { ...m, rotationIndex: groupMembers.find((x) => x.id === memberId)!.rotationIndex };
    return { ...m };
  });
  const swappedRun = runSimulation(swappedMembers, numWeekends);

  let sat = nextSaturday(new Date());
  const items: WeekendPreviewItem[] = [];
  for (let i = 0; i < numWeekends; i++) {
    const sun = addDays(sat, 1);
    const satStr = format(sat, "dd/MM/yyyy");
    const sunStr = format(sun, "dd/MM/yyyy");
    const satKey = format(sat, "yyyy-MM-dd");
    const sunKey = format(sun, "yyyy-MM-dd");
    const label = format(sat, "d MMM", { locale: ptBR }) + " – " + format(sun, "d MMM", { locale: ptBR });
    items.push({
      weekendLabel: label,
      saturday: satStr,
      sunday: sunStr,
      saturdayDateKey: satKey,
      sundayDateKey: sunKey,
      currentUserWorks: currentRun.userWorks[i],
      afterSwapUserWorks: swappedRun.userWorks[i],
    });
    sat = addDays(sat, 7);
  }

  return items;
}

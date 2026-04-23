import {
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  getDay,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";

/**
 * Escala de Sobreaviso — regras:
 *
 * - Períodos: semana de sexta a sexta; as trocas ocorrem na sexta.
 * - Grupos: um por teamLevelId (nível do catálogo) com membros sobreaviso=true.
 * - Uma fila por grupo (onCallRotationIndex); sempre o próximo da fila.
 * - Ao gerar o mês seguinte, o próximo continua de onde o último parou.
 * - Independente da escala normal. Para regerar, é preciso limpar antes.
 */

export interface OnCallWeek {
  startDate: string;
  endDate: string;
  memberId: string;
  memberName: string;
  /** Label do nível (catálogo). */
  level: string;
  teamLevelId: string;
}

const FRIDAY = 5;

interface OnCallQueueMember {
  id: string;
  name: string;
  teamLevelId: string;
  teamLevelLabel: string;
  onCallRotationIndex: number;
}

function fridayOnOrBefore(date: Date): Date {
  const dow = getDay(date);
  const diff = (dow - FRIDAY + 7) % 7;
  return diff === 0 ? new Date(date) : subDays(date, diff);
}

/**
 * Sextas que cobrem o mês: da sexta no ou antes do dia 1 até a primeira sexta após o fim do mês.
 */
function getFridayBoundaries(year: number, month: number): Date[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const first = fridayOnOrBefore(monthStart);
  const fridays: Date[] = [];
  let d = new Date(first);
  while (d <= monthEnd) {
    fridays.push(new Date(d));
    d = addDays(d, 7);
  }
  fridays.push(new Date(d));
  return fridays;
}

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getQueueForGroup(
  members: OnCallQueueMember[],
  teamLevelId: string,
): OnCallQueueMember[] {
  return members
    .filter((m) => m.teamLevelId === teamLevelId)
    .sort((a, b) => a.onCallRotationIndex - b.onCallRotationIndex);
}

/** Escolhe o próximo da fila e devolve o novo índice (max+1) para avançar a fila. */
function pickNextAndAdvance(
  queue: OnCallQueueMember[],
): { selected: OnCallQueueMember; newIndex: number } | null {
  if (queue.length === 0) return null;
  const selected = queue[0];
  const maxIndex = Math.max(0, ...queue.map((m) => m.onCallRotationIndex));
  return { selected, newIndex: maxIndex + 1 };
}

/**
 * Gera a escala de sobreaviso para o mês (year, month).
 * Agrupa participantes por teamLevelId (nível do catálogo).
 * Membros devem ter `sobreaviso=true` para participar.
 */
export async function generateSobreavisoSchedule(
  month: number,
  year: number,
  teamId?: string | null,
): Promise<OnCallWeek[]> {
  const eligibleMembers = await prisma.teamMember.findMany({
    where: {
      sobreaviso: true,
      ...(teamId ? { teamId } : {}),
    },
    select: {
      id: true,
      name: true,
      teamLevelId: true,
      teamLevel: { select: { label: true } },
      onCallRotationIndex: true,
    },
    orderBy: [{ teamLevel: { sortOrder: "asc" } }, { name: "asc" }],
  });

  const queueMembers: OnCallQueueMember[] = eligibleMembers.map((m) => ({
    id: m.id,
    name: m.name,
    teamLevelId: m.teamLevelId,
      teamLevelLabel: m.teamLevel?.label ?? m.teamLevelId,
    onCallRotationIndex: m.onCallRotationIndex,
  }));

  // Grupos únicos de teamLevelId entre os elegíveis
  const groupIds = [...new Set(queueMembers.map((m) => m.teamLevelId))];
  // Map teamLevelId → label (para o result)
  const labelByGroupId = new Map<string, string>(
    queueMembers.map((m) => [m.teamLevelId, m.teamLevelLabel]),
  );

  const monthStart = startOfMonth(new Date(year, month - 1));
  const nextMonthStart = startOfMonth(new Date(year, month));
  const monthStartNoonUtc = new Date(toDateKey(monthStart) + "T12:00:00.000Z");
  const nextMonthStartNoonUtc = new Date(
    toDateKey(nextMonthStart) + "T12:00:00.000Z",
  );

  const fridays = getFridayBoundaries(year, month);
  if (fridays.length < 2) return [];

  const result: OnCallWeek[] = [];
  const rotationUpdates = new Map<string, number>();

  const currentByGroup = new Map<string, OnCallQueueMember | null>();
  for (const gid of groupIds) currentByGroup.set(gid, null);

  for (let i = 0; i < fridays.length - 1; i++) {
    const periodStart = fridays[i];

    for (const gid of groupIds) {
      const current = currentByGroup.get(gid);

      if (periodStart >= monthStart) {
        const queue = getQueueForGroup(queueMembers, gid);
        const pick = pickNextAndAdvance(queue);
        if (!pick) continue;

        const { selected, newIndex } = pick;
        rotationUpdates.set(selected.id, newIndex);
        selected.onCallRotationIndex = newIndex;
        currentByGroup.set(gid, selected);
      } else if (!current) {
        const queue = getQueueForGroup(queueMembers, gid);
        if (queue.length === 0) continue;
        currentByGroup.set(gid, queue[queue.length - 1]);
      }

      const resolvedCurrent = currentByGroup.get(gid);
      if (!resolvedCurrent) continue;

      const periodEnd = fridays[i + 1];
      const segStart = periodStart < monthStart ? monthStart : periodStart;
      const segEnd = periodEnd > nextMonthStart ? nextMonthStart : periodEnd;

      if (segStart >= segEnd) continue;

      result.push({
        startDate: toDateKey(segStart),
        endDate: toDateKey(segEnd),
        memberId: resolvedCurrent.id,
        memberName: resolvedCurrent.name,
        level: labelByGroupId.get(gid) ?? gid,
        teamLevelId: gid,
      });
    }
  }

  // Apaga assignments que possuem interseção com o mês
  await prisma.onCallAssignment.deleteMany({
    where: {
      startDate: { lt: nextMonthStartNoonUtc },
      endDate: { gt: monthStartNoonUtc },
      ...(teamId ? { member: { teamId } } : {}),
    },
  });

  for (const week of result) {
    const member = eligibleMembers.find((m) => m.id === week.memberId);
    await prisma.onCallAssignment.create({
      data: {
        memberId: week.memberId,
        teamLevelId: week.teamLevelId,
        startDate: new Date(week.startDate + "T12:00:00.000Z"),
        endDate: new Date(week.endDate + "T12:00:00.000Z"),
      },
    });
  }

  for (const [memberId, newIndex] of rotationUpdates) {
    await prisma.teamMember.update({
      where: { id: memberId },
      data: { onCallRotationIndex: newIndex },
    });
  }

  return result;
}

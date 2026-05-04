import { startOfMonth, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { loadOnCallSettings } from "@/server/sobreaviso/loadOnCallSettings";

/**
 * Escala de Sobreaviso — regras:
 *
 * - Períodos: intervalos em dias (configurável por nível).
 * - Grupos: um por teamLevelId (nível do catálogo) com membros sobreaviso=true,
 *   filtrados pelos níveis participantes configurados para a equipe.
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

interface OnCallQueueMember {
  id: string;
  name: string;
  teamLevelId: string;
  teamLevelLabel: string;
  onCallRotationIndex: number;
}


function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
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
  const resolvedTeamId = teamId ?? null;
  const settings = resolvedTeamId ? await loadOnCallSettings(resolvedTeamId) : null;
  const participantLevelIdSet = settings ? new Set(settings.participantTeamLevelIds) : null;

  const eligibleMembers = await prisma.teamMember.findMany({
    where: {
      sobreaviso: true,
      ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
      ...(participantLevelIdSet ? { teamLevelId: { in: [...participantLevelIdSet] } } : {}),
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

  const result: OnCallWeek[] = [];
  const rotationUpdates = new Map<string, number>();

  for (const gid of groupIds) {
    const queue = getQueueForGroup(queueMembers, gid);
    if (queue.length === 0) continue;

    const raw = settings?.rotationIntervalDaysByLevel?.[gid];
    const interval = Math.trunc(Number(raw));
    const intervalDays =
      Number.isFinite(interval) && interval > 0 && interval <= 6 ? interval : (settings?.legacyDefaultRotationDays ?? 3);

    let cursor = new Date(monthStartNoonUtc);
    while (cursor < nextMonthStartNoonUtc) {
      const pick = pickNextAndAdvance(queue);
      if (!pick) break;
      const { selected, newIndex } = pick;
      rotationUpdates.set(selected.id, newIndex);
      selected.onCallRotationIndex = newIndex;
      queue.sort((a, b) => a.onCallRotationIndex - b.onCallRotationIndex);

      const segEnd = addDaysUTC(cursor, intervalDays);
      const clampedEnd = segEnd > nextMonthStartNoonUtc ? nextMonthStartNoonUtc : segEnd;
      if (cursor >= clampedEnd) break;

      result.push({
        startDate: toDateKey(cursor),
        endDate: toDateKey(clampedEnd),
        memberId: selected.id,
        memberName: selected.name,
        level: labelByGroupId.get(gid) ?? gid,
        teamLevelId: gid,
      });

      cursor = clampedEnd;
    }
  }

  // Apaga assignments que possuem interseção com o mês
  await prisma.onCallAssignment.deleteMany({
    where: {
      startDate: { lt: nextMonthStartNoonUtc },
      endDate: { gt: monthStartNoonUtc },
      ...(resolvedTeamId ? { member: { teamId: resolvedTeamId } } : {}),
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

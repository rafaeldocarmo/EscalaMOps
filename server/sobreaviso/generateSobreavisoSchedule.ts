import {
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  getDay,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Level } from "@/lib/generated/prisma/enums";

/**
 * Escala de Sobreaviso — regras:
 *
 * - Períodos: semana de sexta a sexta; as trocas ocorrem na sexta.
 * - Níveis: N2, ESPC, PRODUCAO (um por período/semana).
 * - Participam só quem tem o campo "sobreaviso" marcado.
 * - Uma fila por nível (onCallRotationIndex); sempre o próximo da fila.
 * - Ao gerar o mês seguinte, o próximo continua de onde o último parou (fila por nível; com teamId, só entre membros da mesma equipe).
 * - Independente da escala normal. Para regerar, é preciso limpar antes.
 */

export interface OnCallWeek {
  startDate: string;
  endDate: string;
  memberId: string;
  memberName: string;
  level: Level;
}

const FRIDAY = 5;
const ON_CALL_LEVELS: Level[] = ["N2", "ESPC", "PRODUCAO"];

interface OnCallQueueMember {
  id: string;
  name: string;
  level: Level;
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

function getQueueForLevel(members: OnCallQueueMember[], level: Level): OnCallQueueMember[] {
  return members
    .filter((m) => m.level === level)
    .sort((a, b) => a.onCallRotationIndex - b.onCallRotationIndex);
}

/** Escolhe o próximo da fila e devolve o novo índice (max+1) para avançar a fila. */
function pickNextAndAdvance(
  queue: OnCallQueueMember[]
): { selected: OnCallQueueMember; newIndex: number } | null {
  if (queue.length === 0) return null;
  const selected = queue[0];
  const maxIndex = Math.max(0, ...queue.map((m) => m.onCallRotationIndex));
  return { selected, newIndex: maxIndex + 1 };
}

/**
 * Gera a escala de sobreaviso para o mês (year, month).
 * O sobreaviso começa no dia 1: inclui o período que começa na sexta anterior ao dia 1
 * (cobre os primeiros dias do mês até a primeira sexta). Períodos são sexta → sexta.
 */
export async function generateSobreavisoSchedule(
  month: number,
  year: number,
  teamId?: string | null
): Promise<OnCallWeek[]> {
  const eligibleMembers = await prisma.teamMember.findMany({
    where: {
      sobreaviso: true,
      level: { in: ON_CALL_LEVELS },
      ...(teamId ? { teamId } : {}),
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  const queueMembers: OnCallQueueMember[] = eligibleMembers.map((m) => ({
    id: m.id,
    name: m.name,
    level: m.level as Level,
    onCallRotationIndex: m.onCallRotationIndex,
  }));

  // Janela do mês: [monthStart, nextMonthStart)
  // Usamos end exclusivo para garantir que o "fim do sobreaviso" pare no último dia do mês.
  const monthStart = startOfMonth(new Date(year, month - 1));
  const nextMonthStart = startOfMonth(new Date(year, month));
  // Como os assignments são gravados com "T12:00:00.000Z", também comparamos com esses mesmos marcos (evita
  // variação por fuso horário ao checar interseção).
  const monthStartNoonUtc = new Date(toDateKey(monthStart) + "T12:00:00.000Z");
  const nextMonthStartNoonUtc = new Date(toDateKey(nextMonthStart) + "T12:00:00.000Z");

  const fridays = getFridayBoundaries(year, month);
  if (fridays.length < 2) return [];

  const result: OnCallWeek[] = [];
  const rotationUpdates = new Map<string, number>();

  // Para cada nível, controlamos quem está "em curso" até chegar em uma nova sexta (swap).
  // Se o mês COMEÇA numa sexta, a primeira seleção deve ser "o próximo da fila".
  // Se o mês NÃO começa numa sexta, a primeira seleção deve manter quem estava no período em andamento
  // (equivalente a “quem estava no último dia do mês anterior” / “quem estava no último dia do mês”).
  const currentByLevel = new Map<Level, OnCallQueueMember | null>();
  for (const level of ON_CALL_LEVELS) currentByLevel.set(level, null);

  for (let i = 0; i < fridays.length - 1; i++) {
    const periodStart = fridays[i];
    const periodEnd = fridays[i + 1]; // end exclusivo do período sexta->próxima sexta

    for (const level of ON_CALL_LEVELS) {
      const current = currentByLevel.get(level);

      if (periodStart >= monthStart) {
        // Swap acontece na sexta que inicia um período dentro do mês.
        const queue = getQueueForLevel(queueMembers, level);
        const pick = pickNextAndAdvance(queue);
        if (!pick) continue;

        const { selected, newIndex } = pick;
        rotationUpdates.set(selected.id, newIndex);
        selected.onCallRotationIndex = newIndex;
        currentByLevel.set(level, selected);
      } else if (!current) {
        // Mês começou no meio de um período (periodStart < monthStart).
        // O membro em curso deve ser o "último usado" (maior onCallRotationIndex).
        const queue = getQueueForLevel(queueMembers, level);
        if (queue.length === 0) continue;
        currentByLevel.set(level, queue[queue.length - 1]);
      }

      const resolvedCurrent = currentByLevel.get(level);
      if (!resolvedCurrent) continue;

      // Recorta o assignment para ficar somente dentro do mês atual.
      const segStart = periodStart < monthStart ? monthStart : periodStart;
      const segEnd = periodEnd > nextMonthStart ? nextMonthStart : periodEnd;

      if (segStart >= segEnd) continue;

      result.push({
        startDate: toDateKey(segStart),
        endDate: toDateKey(segEnd),
        memberId: resolvedCurrent.id,
        memberName: resolvedCurrent.name,
        level,
      });
    }
  }

  // Apaga apenas assignments que possuem interseção com o mês [monthStart, nextMonthStart).
  await prisma.onCallAssignment.deleteMany({
    where: {
      startDate: { lt: nextMonthStartNoonUtc },
      endDate: { gt: monthStartNoonUtc },
      ...(teamId ? { member: { teamId } } : {}),
    },
  });

  for (const week of result) {
    await prisma.onCallAssignment.create({
      data: {
        memberId: week.memberId,
        level: week.level,
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

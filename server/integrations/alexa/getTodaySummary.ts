import { prisma } from "@/lib/prisma";

function utcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKeyToNoonUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export interface AlexaTodaySummary {
  dateKey: string;
  work: string[];
  off: string[];
  onCall: string[];
}

export async function getTodaySummary(): Promise<AlexaTodaySummary> {
  const now = new Date();
  const dateKey = utcDateKey(now);
  const todayNoonUtc = parseDateKeyToNoonUtc(dateKey);
  const year = todayNoonUtc.getUTCFullYear();
  const month = todayNoonUtc.getUTCMonth() + 1;

  const [members, schedule, onCall] = await Promise.all([
    prisma.teamMember.findMany({
      where: { participatesInSchedule: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.schedule.findUnique({
      where: { year_month: { year, month } },
      select: { id: true },
    }),
    prisma.onCallAssignment.findMany({
      where: {
        startDate: { lte: todayNoonUtc },
        endDate: { gt: todayNoonUtc },
      },
      include: { member: { select: { name: true } } },
      orderBy: [{ level: "asc" }, { member: { name: "asc" } }],
    }),
  ]);

  const offMemberIds = new Set<string>();
  if (schedule) {
    const offAssignments = await prisma.scheduleAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: todayNoonUtc,
        status: "OFF",
      },
      select: { memberId: true },
    });
    for (const row of offAssignments) offMemberIds.add(row.memberId);
  }

  const work: string[] = [];
  const off: string[] = [];
  for (const m of members) {
    if (offMemberIds.has(m.id)) off.push(m.name);
    else work.push(m.name);
  }

  const onCallList = onCall.map((r) => `${r.member.name} (${r.level})`);

  return {
    dateKey,
    work,
    off,
    onCall: onCallList,
  };
}

import { prisma } from "@/lib/prisma";
import { getDefaultTeam } from "@/lib/multiTeam";
import { log } from "@/lib/log";

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

  log({
    level: "info",
    event: "alexa.today_summary.start",
    data: { year, month, dateKey },
  });

  const defaultTeam = await getDefaultTeam();
  const [members, schedule, onCall] = await Promise.all([
    prisma.teamMember.findMany({
      where: { participatesInSchedule: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    defaultTeam
      ? prisma.schedule.findUnique({
          where: { teamId_year_month: { teamId: defaultTeam.id, year, month } },
          select: { id: true },
        })
      : prisma.schedule.findFirst({
          where: { year, month },
          select: { id: true },
        }),
    prisma.onCallAssignment.findMany({
      where: {
        startDate: { lte: todayNoonUtc },
        endDate: { gt: todayNoonUtc },
      },
      include: {
        member: { select: { name: true } },
        teamLevel: { select: { label: true } },
      },
      orderBy: [{ teamLevel: { sortOrder: "asc" } }, { member: { name: "asc" } }],
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
  } else {
    log({
      level: "warn",
      event: "alexa.today_summary.schedule_not_found",
      data: { year, month, dateKey },
    });
  }

  const work: string[] = [];
  const off: string[] = [];
  for (const m of members) {
    if (offMemberIds.has(m.id)) off.push(m.name);
    else work.push(m.name);
  }

  const onCallList = onCall.map((r) => `${r.member.name} (${r.teamLevel?.label ?? ""})`);

  log({
    level: "info",
    event: "alexa.today_summary.success",
    data: {
      year,
      month,
      dateKey,
      membersCount: members.length,
      offCount: off.length,
      workCount: work.length,
      onCallCount: onCallList.length,
      hasSchedule: Boolean(schedule),
    },
  });

  return {
    dateKey,
    work,
    off,
    onCall: onCallList,
  };
}


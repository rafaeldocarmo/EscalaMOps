import { prisma } from "@/lib/prisma";
import { getDefaultTeam } from "@/lib/multiTeam";
import { startOfDay, endOfDay } from "date-fns";
import { log } from "@/lib/log";
import { pinWhatsappMessage, sendWhatsappMessage } from "./sendWhatsappMessage";

/**
 * Monta e envia pelo WhatsApp o resumo da escala do dia informado (ou hoje).
 * Usa os registros de Schedule / ScheduleAssignment para descobrir quem está TRABALHANDO.
 */
export async function sendDailyScheduleSummary(targetDate?: Date): Promise<void> {
  const today = targetDate ?? new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const year = dayStart.getFullYear();
  const month = dayStart.getMonth() + 1;

  log({
    level: "info",
    event: "whatsapp.daily_summary.start",
    data: { year, month, targetDate: dayStart.toISOString() },
  });

  const defaultTeam = await getDefaultTeam();
  const schedule = defaultTeam
    ? await prisma.schedule.findUnique({
        where: { teamId_year_month: { teamId: defaultTeam.id, year, month } },
        select: { id: true },
      })
    : await prisma.schedule.findFirst({
        where: { year, month },
        select: { id: true },
      });

  if (!schedule) {
    log({
      level: "warn",
      event: "whatsapp.daily_summary.schedule_not_found",
      data: { year, month },
    });
    return;
  }

  const [members, offAssignments, onCallAssignments] = await Promise.all([
    prisma.teamMember.findMany({
      where: { participatesInSchedule: true },
      orderBy: [
        { teamLevel: { sortOrder: "asc" } },
        { teamShift: { sortOrder: "asc" } },
        { name: "asc" },
      ],
      select: {
        id: true,
        name: true,
        teamLevelId: true,
        teamShiftId: true,
        teamLevel: { select: { label: true } },
        teamShift: { select: { label: true } },
      },
    }),
    prisma.scheduleAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: { gte: dayStart, lte: dayEnd },
        status: "OFF",
      },
      select: { memberId: true },
    }),
    prisma.onCallAssignment.findMany({
      where: {
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
      include: {
        member: { select: { name: true } },
        teamLevel: { select: { label: true } },
      },
    }),
  ]);

  const offSet = new Set(offAssignments.map((a) => a.memberId));

  // Group members by level → shift
  const byLevel = new Map<string, Map<string, string[]>>();
  const levelOrder: string[] = [];

  for (const member of members) {
    if (offSet.has(member.id)) continue;
    const levelLabel = member.teamLevel.label;
    const shiftLabel = member.teamShift.label;
    if (!byLevel.has(levelLabel)) {
      byLevel.set(levelLabel, new Map());
      levelOrder.push(levelLabel);
    }
    const byShift = byLevel.get(levelLabel)!;
    if (!byShift.has(shiftLabel)) byShift.set(shiftLabel, []);
    byShift.get(shiftLabel)!.push(member.name.trim());
  }

  // Group on-call by level
  const onCallByLevel = new Map<string, string[]>();
  for (const a of onCallAssignments) {
    const lvl = a.teamLevel?.label ?? "—";
    if (!onCallByLevel.has(lvl)) onCallByLevel.set(lvl, []);
    onCallByLevel.get(lvl)!.push(a.member.name.trim());
  }

  const lines: string[] = [];
  lines.push(`*Escala para esse final de semana*`, "");

  for (const level of levelOrder) {
    lines.push(`*${level}*`);
    const byShift = byLevel.get(level)!;
    for (const [shift, names] of byShift) {
      for (const name of names) {
        lines.push(`* \`${shift} - ${name}\``);
      }
    }
    lines.push("");
  }

  lines.push("*SOBREAVISO*", "");
  for (const [level, names] of onCallByLevel) {
    lines.push(`*${level}*`);
    for (const name of names) {
      lines.push(`* \`${level} - ${name}\``);
    }
    lines.push("");
  }

  lines.push("_*Recomendações:*_");
  lines.push("* Mantenha o celular sempre carregado.");
  lines.push("* Fique atento aos chamados do N2.");
  lines.push("* Evite deslocamentos para locais sem acesso à internet.");
  lines.push("* Não deixe o celular no modo silencioso.");
  lines.push("* Verifique se sua senha está próxima de expirar.");

  const message = lines.join("\n");
  const { messageId } = await sendWhatsappMessage(message);
  if (messageId) {
    await pinWhatsappMessage(messageId).catch(() => {});
  }

  log({
    level: "info",
    event: "whatsapp.daily_summary.sent",
    data: { year, month, messageId: messageId ?? null },
  });
}

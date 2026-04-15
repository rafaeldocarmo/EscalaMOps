import { prisma } from "@/lib/prisma";
import { getDefaultTeam } from "@/lib/multiTeam";
import { startOfDay, endOfDay } from "date-fns";
import { log } from "@/lib/log";
import { pinWhatsappMessage, sendWhatsappMessage } from "./sendWhatsappMessage";

type Level = "N1" | "N2";
type Shift = "T1" | "T2" | "T3";

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
      where: { level: { in: ["N1", "N2"] }, participatesInSchedule: true },
      orderBy: [{ level: "asc" }, { shift: "asc" }, { name: "asc" }],
      select: { id: true, name: true, level: true, shift: true },
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
      include: { member: { select: { name: true, level: true, shift: true } } },
    }),
  ]);

  const offSet = new Set(offAssignments.map((a) => a.memberId));

  const levels: Level[] = ["N1", "N2"];
  const shiftsByLevel: Record<Level, Shift[]> = {
    N1: ["T1", "T2", "T3"],
    N2: ["T1", "T2"],
  };

  const groups: Record<Level, Record<Shift, string[]>> = {
    N1: { T1: [], T2: [], T3: [] },
    N2: { T1: [], T2: [], T3: [] },
  };

  type OnCallLevel = "N2" | "ESPC" | "PRODUCAO";
  const onCallGroups: Record<OnCallLevel, string[]> = {
    N2: [],
    ESPC: [],
    PRODUCAO: [],
  };

  function fullName(name: string): string {
    return name.trim();
  }

  for (const member of members) {
    const level = member.level as Level;
    const shift = member.shift as Shift;

    if (level === "N2" && shift === "T3") continue;
    if (offSet.has(member.id)) continue;

    groups[level][shift].push(fullName(member.name));
  }

  for (const a of onCallAssignments) {
    const level = a.level as OnCallLevel;
    if (level in onCallGroups) {
      onCallGroups[level].push(fullName(a.member.name));
    }
  }

  const lines: string[] = [];
  lines.push(`*Escala para esse final de semana*`, "");

  for (const level of levels) {
    lines.push(`*${level}*`);
    for (const shift of shiftsByLevel[level]) {
      const names = groups[level][shift];
      if (names.length > 0) {
        for (const name of names) {
          lines.push(`* \`${shift} - ${name}\``);
        }
      }
    }
    lines.push("");
  }

  lines.push("*SOBREAVISO*", "");
  lines.push("*N2*");
  for (const name of onCallGroups.N2) {
    lines.push(`* \`N2 - ${name}\``);
  }
  lines.push("");
  lines.push("*ESP/PROD*");
  for (const name of onCallGroups.ESPC) {
    lines.push(`* \`ESP - ${name}\``);
  }
  for (const name of onCallGroups.PRODUCAO) {
    lines.push(`* \`Prod. Online - ${name}\``);
  }
  lines.push("");
  lines.push("_*Recomendações:*_");
  lines.push("* Mantenha o celular sempre carregado.");
  lines.push("* Fique atento aos chamados do N2.");
  lines.push("* Evite deslocamentos para locais sem acesso à internet.");
  lines.push("* Não deixe o celular no modo silencioso.");
  lines.push("* Verifique se sua senha está próxima de expirar.");

  const message = lines.join("\n");
  const { messageId } = await sendWhatsappMessage(message);
  if (messageId) {
    // Fixamos/pinamos a mensagem do dia para ficar sempre visível.
    await pinWhatsappMessage(messageId).catch(() => {});
  }

  log({
    level: "info",
    event: "whatsapp.daily_summary.sent",
    data: { year, month, messageId: messageId ?? null },
  });
}


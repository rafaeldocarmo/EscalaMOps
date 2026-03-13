import { prisma } from "@/lib/prisma";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendWhatsappMessage } from "./sendWhatsappMessage";

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

  const schedule = await prisma.schedule.findUnique({
    where: { year_month: { year, month } },
    select: { id: true },
  });

  if (!schedule) {
    console.error("sendDailyScheduleSummary: schedule not found for", { year, month });
    return;
  }

  const [members, offAssignments] = await Promise.all([
    prisma.teamMember.findMany({
      where: { level: { in: ["N1", "N2"] } },
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

  for (const member of members) {
    const level = member.level as Level;
    const shift = member.shift as Shift;

    // N2 não existe em T3
    if (level === "N2" && shift === "T3") continue;
    if (offSet.has(member.id)) continue;

    const name = member.name.trim();
    const parts = name.split(/\s+/);
    const displayName = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;

    groups[level][shift].push(displayName);
  }

  const dateLabel = format(dayStart, "dd/MM/yyyy", { locale: ptBR });

  const lines: string[] = [];
  lines.push(`*Escala do dia - ${dateLabel}*`, "");

  for (const level of levels) {
    lines.push(`*${level}*`);
    for (const shift of shiftsByLevel[level]) {
      const names = groups[level][shift];
      const namesText = names.length > 0 ? names.join(", ") : "-";
      lines.push(` * \`${shift} - ${namesText}\``);
    }
    lines.push("");
  }

  const message = lines.join("\n");
  await sendWhatsappMessage(message);
}


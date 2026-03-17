import { prisma } from "@/lib/prisma";

async function main() {
  const schedules = await prisma.schedule.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 6,
    select: {
      id: true,
      year: true,
      month: true,
      _count: { select: { assignments: true } },
    },
  });

  const assignments = await prisma.scheduleAssignment.findMany({
    orderBy: { date: "desc" },
    take: 20,
    select: { scheduleId: true, memberId: true, date: true, status: true },
  });

  const members = await prisma.teamMember.findMany({
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, phone: true, normalizedPhone: true, level: true, shift: true },
  });

  console.log(JSON.stringify({ schedules, assignments, members }, null, 2));

  if (schedules.length > 0) {
    const scheduleId = schedules[0].id;
    const byMember = await prisma.scheduleAssignment.groupBy({
      by: ["memberId"],
      where: { scheduleId },
      _count: { memberId: true },
      orderBy: { _count: { memberId: "asc" } },
      take: 15,
    });
    console.log("lowest assignment counts", byMember);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


async function main() {
  const { PrismaClient } = await import("../lib/generated/prisma");
  const prisma = new PrismaClient();

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

  console.log({ schedules, assignments, members });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


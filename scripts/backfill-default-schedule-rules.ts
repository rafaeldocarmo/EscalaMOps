/**
 * Popula as regras default de escala (WEEKEND_COVERAGE e COMPENSATION_PATTERN)
 * para todas as equipes já existentes no banco. Idempotente: nunca sobrescreve
 * uma regra já configurada, só cria as faltantes.
 *
 * Rode uma vez após aplicar a migration 20260417150000_add_schedule_rules:
 *   npx tsx scripts/backfill-default-schedule-rules.ts
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDefaultScheduleRulesForTeam } from "../server/schedule/seedDefaultScheduleRules";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  console.log(`Processando ${teams.length} equipe(s)...`);

  let totalWc = 0;
  let totalCp = 0;
  for (const team of teams) {
    const result = await seedDefaultScheduleRulesForTeam(prisma, team.id);
    totalWc += result.createdWeekendCoverage;
    totalCp += result.createdCompensation;
    console.log(
      `- ${team.name}: criadas ${result.createdWeekendCoverage} regras de cobertura e ${result.createdCompensation} de compensação.`
    );
  }

  console.log(`\nTotal: ${totalWc} WEEKEND_COVERAGE + ${totalCp} COMPENSATION_PATTERN.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

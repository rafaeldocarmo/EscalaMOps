import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDefaultScheduleRulesForTeam } from "../server/schedule/seedDefaultScheduleRules";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_TEAM_NAME = process.env.DEFAULT_TEAM_NAME?.trim() || "Equipe Principal";

function normalizePhone(phone: string) {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length === 11 && !digitsOnly.startsWith("55")) return `${digitsOnly}`;
  return digitsOnly;
}

type SeedLevel = { label: string; sortOrder: number };
type SeedShift = { label: string; sortOrder: number };

const CATALOG_LEVELS: SeedLevel[] = [
  { label: "N1", sortOrder: 0 },
  { label: "N2", sortOrder: 1 },
  { label: "ESPC", sortOrder: 2 },
  { label: "Produção", sortOrder: 3 },
];

const CATALOG_SHIFTS: SeedShift[] = [
  { label: "T1", sortOrder: 0 },
  { label: "T2", sortOrder: 1 },
  { label: "T3", sortOrder: 2 },
  { label: "TC", sortOrder: 3 },
];

type SeedMember = {
  name: string;
  phone: string;
  levelLabel: string;
  shiftLabel: string;
  sobreaviso: boolean;
};

async function ensureCatalogForTeam(teamId: string) {
  const levelIds: Record<string, string> = {};
  for (const lv of CATALOG_LEVELS) {
    const existing = await prisma.teamLevel.findFirst({
      where: { teamId, label: lv.label },
      select: { id: true },
    });
    if (existing) {
      levelIds[lv.label] = existing.id;
    } else {
      const row = await prisma.teamLevel.create({
        data: { teamId, label: lv.label, sortOrder: lv.sortOrder },
        select: { id: true },
      });
      levelIds[lv.label] = row.id;
    }
  }

  const shiftIds: Record<string, string> = {};
  for (const sh of CATALOG_SHIFTS) {
    const existing = await prisma.teamShift.findFirst({
      where: { teamId, label: sh.label },
      select: { id: true },
    });
    if (existing) {
      shiftIds[sh.label] = existing.id;
    } else {
      const row = await prisma.teamShift.create({
        data: { teamId, label: sh.label, sortOrder: sh.sortOrder },
        select: { id: true },
      });
      shiftIds[sh.label] = row.id;
    }
  }

  for (const lv of CATALOG_LEVELS) {
    for (const sh of CATALOG_SHIFTS) {
      await prisma.teamLevelAllowedShift.upsert({
        where: {
          teamLevelId_teamShiftId: {
            teamLevelId: levelIds[lv.label],
            teamShiftId: shiftIds[sh.label],
          },
        },
        create: {
          teamLevelId: levelIds[lv.label],
          teamShiftId: shiftIds[sh.label],
        },
        update: {},
      });
    }
  }

  return { levelIds, shiftIds };
}

async function main() {
  const team = await prisma.team.upsert({
    where: { name: DEFAULT_TEAM_NAME },
    create: { name: DEFAULT_TEAM_NAME, isDefault: true },
    update: { isDefault: true },
    select: { id: true },
  });

  const { levelIds, shiftIds } = await ensureCatalogForTeam(team.id);

  const teamMembers: SeedMember[] = [
    // ESPECIALISTAS (ESPC) - TC
    { name: "CAUE OLIVEIRA LONGHI", phone: "(11)94333-3360", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: true },
    { name: "HAROLDO JOSE RIOS DA SILVA", phone: "(11)98341-9398", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "RICARDO TELES DE ANDRADE", phone: "(13)99733-9971", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "LUCAS SALLES DE MELO PEREIRA", phone: "(11)97785-5369", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: true },
    { name: "LEONARDO CHIMINELLI", phone: "(16)99129-8341", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "WANDERSON DA SILVA ARAUJO", phone: "(11)95273-8622", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: true },
    { name: "JOAO VITOR FALBI", phone: "(11)94789-2913", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: true },
    { name: "LUIS GUSTAVO SANTOS QUEIROZ", phone: "(11)98822-1393", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: true },
    { name: "RAFAEL MARTINEZ DO CARMO", phone: "(11)99316-4203", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "VINICIUS ALVES CORREIA", phone: "(11)94779-0265", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "ALEXANDER PASTOS JUNIOR", phone: "(16)99771-3354", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "LEANDRO DE SOUZA BERNARDO", phone: "(11)98086-9572", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "BRUNO TREVISOL", phone: "(16)99777-7360", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: false },
    { name: "EDUARDO MARTINS DOS SANTOS", phone: "(11)96162-7928", levelLabel: "ESPC", shiftLabel: "TC", sobreaviso: true },

    // PRODUÇÃO - TC
    { name: "EURICO", phone: "(11)99476-7020", levelLabel: "Produção", shiftLabel: "TC", sobreaviso: true },
    { name: "HUMBERTO", phone: "(11)96072-1837", levelLabel: "Produção", shiftLabel: "TC", sobreaviso: true },
    { name: "ALEX", phone: "(11)98788-7444", levelLabel: "Produção", shiftLabel: "TC", sobreaviso: true },

    // N2 - T1
    { name: "EDUARDO NEVES GIESTAL", phone: "(11)95551-8373", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },
    { name: "KAINA MARTINHO CARMO DE BARROS", phone: "(16)99799-4883", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },
    { name: "GUILHERME BONDEZAN YONAMINE", phone: "(11)94008-6000", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },
    { name: "JOÃO PEDRO VILLAS BOAS DE CARVALHO", phone: "(11)94550-7006", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },
    { name: "CRISTIAN SARAIVA BETTUCI", phone: "(16)99151-9120", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },
    { name: "MAURICIO JOSE PRADO CHINI", phone: "(15)99197-6851", levelLabel: "N2", shiftLabel: "T1", sobreaviso: true },
    { name: "THIAGO BORGHI LOPES GALVÃO", phone: "(16)99731-8835", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },
    { name: "VINICIUS SOARES PEREIRA MARTINS DE MOURA", phone: "(13)98816-8347", levelLabel: "N2", shiftLabel: "T1", sobreaviso: true },
    { name: "FELIPE SILVA CORREIA", phone: "(11)99989-6607", levelLabel: "N2", shiftLabel: "T1", sobreaviso: false },

    // N2 - T2
    { name: "ALISON DEYCLES LUCIO DA SILVA", phone: "(11)98904-5355", levelLabel: "N2", shiftLabel: "T2", sobreaviso: false },
    { name: "DIEGHO MORAES BISTRATINI", phone: "(11)99782-3931", levelLabel: "N2", shiftLabel: "T2", sobreaviso: false },
    { name: "DANIEL DOS SANTOS REIS", phone: "(11)98302-3191", levelLabel: "N2", shiftLabel: "T2", sobreaviso: true },
    { name: "FILIPI DA SILVA SOUZA", phone: "(13)98801-0524", levelLabel: "N2", shiftLabel: "T2", sobreaviso: true },
    { name: "JONATAS DA SILVA PEREIRA", phone: "(11)99652-1707", levelLabel: "N2", shiftLabel: "T2", sobreaviso: false },
    { name: "DIEGO VERGA TEIXEIRA", phone: "(16)99239-2036", levelLabel: "N2", shiftLabel: "T2", sobreaviso: false },

    // N1 - T1
    { name: "LETÍCIA NOVARINO BRITTO", phone: "(16)99167-4097", levelLabel: "N1", shiftLabel: "T1", sobreaviso: false },
    { name: "GABRIEL BENACCI POPAZOGLO", phone: "(11)91858-1937", levelLabel: "N1", shiftLabel: "T1", sobreaviso: false },
    { name: "MATHEUS DE ALMEIDA MARQUES", phone: "(11)95450-7278", levelLabel: "N1", shiftLabel: "T1", sobreaviso: false },
    { name: "MICHELLE CRISTINA DA SILVA RICARDO", phone: "(19)99860-5436", levelLabel: "N1", shiftLabel: "T1", sobreaviso: false },
    { name: "TAMIRES COSTA SANTOS", phone: "(11)95232-1004", levelLabel: "N1", shiftLabel: "T1", sobreaviso: false },

    // N1 - T2
    { name: "GUSTAVO ALVES FELIX DE OLIVEIRA", phone: "(11)96244-6188", levelLabel: "N1", shiftLabel: "T2", sobreaviso: false },
    { name: "TAUA EDUARDO MARINS", phone: "(19)98387-3130", levelLabel: "N1", shiftLabel: "T2", sobreaviso: false },
    { name: "GIULLIANO ALEX DE MORAES", phone: "(19)99898-0452", levelLabel: "N1", shiftLabel: "T2", sobreaviso: false },
    { name: "VICTOR SALES PIMENTEL DE SOUZA", phone: "(11)93762-2247", levelLabel: "N1", shiftLabel: "T2", sobreaviso: false },
    { name: "DIEGO VERGA TEIXEIRA", phone: "(11)99622-5367", levelLabel: "N1", shiftLabel: "T2", sobreaviso: false },

    // N1 - T3
    { name: "GUILHERME MESQUITA RODRIGUES DE LIMA CAMPOS", phone: "(13)99151-9954", levelLabel: "N1", shiftLabel: "T3", sobreaviso: false },
    { name: "IVAN FELIPE SANCHEZ", phone: "(11)96794-4871", levelLabel: "N1", shiftLabel: "T3", sobreaviso: false },
    { name: "GABRIEL OLIVEIRA FREITAS DOS SANTOS", phone: "(13)99184-6818", levelLabel: "N1", shiftLabel: "T3", sobreaviso: false },
    { name: "RAFAEL TELES DE ANDRADE", phone: "(13)99203-6983", levelLabel: "N1", shiftLabel: "T3", sobreaviso: false },
  ];

  await prisma.teamMember.createMany({
    data: teamMembers.map((member) => ({
      teamId: team.id,
      teamLevelId: levelIds[member.levelLabel],
      teamShiftId: shiftIds[member.shiftLabel],
      name: member.name,
      phone: member.phone,
      normalizedPhone: normalizePhone(member.phone),
      sobreaviso: member.sobreaviso,
    })),
  });

  await seedDefaultScheduleRulesForTeam(prisma, team.id);
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

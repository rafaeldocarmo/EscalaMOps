import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Level, Shift } from "../lib/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.teamMember.createMany({
    data: [
      // ESPECIALISTAS (ESPC) - TC
      { name: "CAUE OLIVEIRA LONGHI", phone: "(11)94333-3360", level: Level.ESPC, shift: Shift.TC, sobreaviso: true },
      { name: "HAROLDO JOSE RIOS DA SILVA", phone: "(11)98341-9398", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "RICARDO TELES DE ANDRADE", phone: "(13)99733-9971", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "LUCAS SALLES DE MELO PEREIRA", phone: "(11)97785-5369", level: Level.ESPC, shift: Shift.TC, sobreaviso: true },
      { name: "LEONARDO CHIMINELLI", phone: "(16)99129-8341", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "WANDERSON DA SILVA ARAUJO", phone: "(11)95273-8622", level: Level.ESPC, shift: Shift.TC, sobreaviso: true },
      { name: "JOAO VITOR FALBI", phone: "(11)94789-2913", level: Level.ESPC, shift: Shift.TC, sobreaviso: true },
      { name: "LUIS GUSTAVO SANTOS QUEIROZ", phone: "(11)98822-1393", level: Level.ESPC, shift: Shift.TC, sobreaviso: true },
      { name: "RAFAEL MARTINEZ DO CARMO", phone: "(11)99316-4203", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "VINICIUS ALVES CORREIA", phone: "(11)94779-0265", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "ALEXANDER PASTOS JUNIOR", phone: "(16)99771-3354", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "LEANDRO DE SOUZA BERNARDO", phone: "(11)98086-9572", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "BRUNO TREVISOL", phone: "(16)99777-7360", level: Level.ESPC, shift: Shift.TC, sobreaviso: false },
      { name: "EDUARDO MARTINS DOS SANTOS", phone: "(11)96162-7928", level: Level.ESPC, shift: Shift.TC, sobreaviso: true },

      // PRODUÇÃO (PRODUCAO) - TC
      { name: "EURICO", phone: "(11)99476-7020", level: Level.PRODUCAO, shift: Shift.TC, sobreaviso: true },
      { name: "HUMBERTO", phone: "(11)96072-1837", level: Level.PRODUCAO, shift: Shift.TC, sobreaviso: true },
      { name: "ALEX", phone: "(11)98788-7444", level: Level.PRODUCAO, shift: Shift.TC, sobreaviso: true },

      // N2 - T1
      { name: "EDUARDO NEVES GIESTAL", phone: "(11)95551-8373", level: Level.N2, shift: Shift.T1, sobreaviso: false },
      { name: "KAINA MARTINHO CARMO DE BARROS", phone: "(16)99799-4883", level: Level.N2, shift: Shift.T1, sobreaviso: false },
      { name: "GUILHERME BONDEZAN YONAMINE", phone: "(11)94008-6000", level: Level.N2, shift: Shift.T1, sobreaviso: false },
      { name: "JOÃO PEDRO VILLAS BOAS DE CARVALHO", phone: "(11)94550-7006", level: Level.N2, shift: Shift.T1, sobreaviso: false },
      { name: "CRISTIAN SARAIVA BETTUCI", phone: "(16)99151-9120", level: Level.N2, shift: Shift.T1, sobreaviso: false },
      { name: "MAURICIO JOSE PRADO CHINI", phone: "(15)99197-6851", level: Level.N2, shift: Shift.T1, sobreaviso: true },
      { name: "THIAGO BORGHI LOPES GALVÃO", phone: "(16)99731-8835", level: Level.N2, shift: Shift.T1, sobreaviso: false },
      { name: "VINICIUS SOARES PEREIRA MARTINS DE MOURA", phone: "(13)98816-8347", level: Level.N2, shift: Shift.T1, sobreaviso: true },
      { name: "FELIPE SILVA CORREIA", phone: "(11)99989-6607", level: Level.N2, shift: Shift.T1, sobreaviso: false },

      // N2 - T2
      { name: "ALISON DEYCLES LUCIO DA SILVA", phone: "(11)98904-5355", level: Level.N2, shift: Shift.T2, sobreaviso: false },
      { name: "DIEGHO MORAES BISTRATINI", phone: "(11)99782-3931", level: Level.N2, shift: Shift.T2, sobreaviso: false },
      { name: "DANIEL DOS SANTOS REIS", phone: "(11)98302-3191", level: Level.N2, shift: Shift.T2, sobreaviso: true },
      { name: "FILIPI DA SILVA SOUZA", phone: "(13)98801-0524", level: Level.N2, shift: Shift.T2, sobreaviso: true },
      { name: "JONATAS DA SILVA PEREIRA", phone: "(11)99652-1707", level: Level.N2, shift: Shift.T2, sobreaviso: false },
      { name: "DIEGO VERGA TEIXEIRA", phone: "(16)99239-2036", level: Level.N2, shift: Shift.T2, sobreaviso: false },

      // N1 - T1
      { name: "LETÍCIA NOVARINO BRITTO", phone: "(16)99167-4097", level: Level.N1, shift: Shift.T1, sobreaviso: false },
      { name: "GABRIEL BENACCI POPAZOGLO", phone: "(11)91858-1937", level: Level.N1, shift: Shift.T1, sobreaviso: false },
      { name: "MATHEUS DE ALMEIDA MARQUES", phone: "(11)95450-7278", level: Level.N1, shift: Shift.T1, sobreaviso: false },
      { name: "MICHELLE CRISTINA DA SILVA RICARDO", phone: "(19)99860-5436", level: Level.N1, shift: Shift.T1, sobreaviso: false },
      { name: "TAMIRES COSTA SANTOS", phone: "(11)95232-1004", level: Level.N1, shift: Shift.T1, sobreaviso: false },

      // N1 - T2
      { name: "GUSTAVO ALVES FELIX DE OLIVEIRA", phone: "(11)96244-6188", level: Level.N1, shift: Shift.T2, sobreaviso: false },
      { name: "TAUA EDUARDO MARINS", phone: "(19)98387-3130", level: Level.N1, shift: Shift.T2, sobreaviso: false },
      { name: "GIULLIANO ALEX DE MORAES", phone: "(19)99898-0452", level: Level.N1, shift: Shift.T2, sobreaviso: false },
      { name: "VICTOR SALES PIMENTEL DE SOUZA", phone: "(11)93762-2247", level: Level.N1, shift: Shift.T2, sobreaviso: false },
      { name: "DIEGO VERGA TEIXEIRA", phone: "(11)99622-5367", level: Level.N1, shift: Shift.T2, sobreaviso: false },

      // N1 - T3
      { name: "GUILHERME MESQUITA RODRIGUES DE LIMA CAMPOS", phone: "(13)99151-9954", level: Level.N1, shift: Shift.T3, sobreaviso: false },
      { name: "IVAN FELIPE SANCHEZ", phone: "(11)96794-4871", level: Level.N1, shift: Shift.T3, sobreaviso: false },
      { name: "GABRIEL OLIVEIRA FREITAS DOS SANTOS", phone: "(13)99184-6818", level: Level.N1, shift: Shift.T3, sobreaviso: false },
      { name: "RAFAEL TELES DE ANDRADE", phone: "(13)99203-6983", level: Level.N1, shift: Shift.T3, sobreaviso: false },
    ],
  });
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

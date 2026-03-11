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
      // N2 - T1
      { name: "EDUARDO NEVES GIESTAL", phone: "(11)95551-8373", level: Level.N2, shift: Shift.T1 },
      { name: "KAINA MARTINHO CARMO DE BARROS", phone: "(16)99799-4883", level: Level.N2, shift: Shift.T1 },
      { name: "Guilherme Bondezan Yonamine", phone: "", level: Level.N2, shift: Shift.T1 },
      { name: "João Pedro Villas Boas de Carvalho", phone: "(11)94550-7006", level: Level.N2, shift: Shift.T1 },
      { name: "CRISTIAN SARAIVA BETTUCI", phone: "(16)99151-9120", level: Level.N2, shift: Shift.T1 },
      { name: "MAURICIO JOSE PRADO CHINI", phone: "(15)99197-6851", level: Level.N2, shift: Shift.T1 },
      { name: "THIAGO BORGHI LOPES GALVÃO", phone: "(16)99731-8835", level: Level.N2, shift: Shift.T1 },
      { name: "VINICIUS SOARES PEREIRA MARTINS DE MOURA", phone: "(13)98816-8347", level: Level.N2, shift: Shift.T1 },
      { name: "FELIPE SILVA CORREIA", phone: "(11)99989-6607", level: Level.N2, shift: Shift.T1 },

      // N2 - T2
      { name: "ALISON DEYCLES LUCIO DA SILVA", phone: "(11)98904-5355", level: Level.N2, shift: Shift.T2 },
      { name: "DIEGHO MORAES BISTRATINI", phone: "(11)99782-3931", level: Level.N2, shift: Shift.T2 },
      { name: "DANIEL DOS SANTOS REIS", phone: "(11)98302-3191", level: Level.N2, shift: Shift.T2 },
      { name: "FILIPI DA SILVA SOUZA", phone: "(13)98801-0524", level: Level.N2, shift: Shift.T2 },
      { name: "JONATAS DA SILVA PEREIRA", phone: "(11)99652-1707", level: Level.N2, shift: Shift.T2 },
      { name: "DIEGO VERGA TEIXEIRA", phone: "(16)99239-2036", level: Level.N2, shift: Shift.T2 },

      // N1 - T1
      { name: "LETÍCIA NOVARINO BRITTO", phone: "(16)99167-4097", level: Level.N1, shift: Shift.T1 },
      { name: "GABRIEL BENACCI POPAZOGLO", phone: "(11)91858-1937", level: Level.N1, shift: Shift.T1 },
      { name: "Matheus de Almeida Marques", phone: "", level: Level.N1, shift: Shift.T1 },
      { name: "MICHELLE CRISTINA DA SILVA RICARDO", phone: "(19)99860-5436", level: Level.N1, shift: Shift.T1 },
      { name: "TAMIRES COSTA SANTOS", phone: "", level: Level.N1, shift: Shift.T1 },

      // N1 - T2
      { name: "GUSTAVO ALVES FELIX DE OLIVEIRA", phone: "(11)96244-6188", level: Level.N1, shift: Shift.T2 },
      { name: "Taua Eduardo Marins", phone: "(19)98387-3130", level: Level.N1, shift: Shift.T2 },
      { name: "GIULLIANO ALEX DE MORAES", phone: "", level: Level.N1, shift: Shift.T2 },
      { name: "Victor Sales Pimentel de Souza", phone: "", level: Level.N1, shift: Shift.T2 },
      { name: "DIEGO VERGA TEIXEIRA", phone: "(11)99622-5367", level: Level.N1, shift: Shift.T2 },

      // N1 - T3
      { name: "GUILHERME MESQUITA RODRIGUES DE LIMA CAMPOS", phone: "(13)99151-9954", level: Level.N1, shift: Shift.T3 },
      { name: "IVAN FELIPE SANCHEZ", phone: "(11)96794-4871", level: Level.N1, shift: Shift.T3 },
      { name: "GABRIEL OLIVEIRA FREITAS DOS SANTOS", phone: "(13)99184-6818", level: Level.N1, shift: Shift.T3 },
      { name: "RAFAEL TELES DE ANDRADE", phone: "(13)99203-6983", level: Level.N1, shift: Shift.T3 },
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

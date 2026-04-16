import { clearSobreavisoForMonth } from "@/server/sobreaviso/clearSobreavisoForMonth";
import { generateSobreavisoForMonth } from "@/server/sobreaviso/generateSobreavisoForMonth";
import { adminSwapOnCallPositions } from "@/server/sobreaviso/adminSwapOnCallPositions";
import { prisma } from "@/lib/prisma";
import { Level, Shift } from "@/lib/generated/prisma/enums";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import { sessionAsAdmin, sessionAsAdminTeam, sessionAsPlainUser } from "@/tests/helpers/session-factory";
import {
  cleanupTeamAndOnCallAssignments,
  createTeamWithSobreavisoMembers,
} from "@/tests/helpers/sobreaviso-test-context";
import { createEmptyTeam, uniqueTeamName } from "@/tests/helpers/team-crud-context";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

/** Mês com semanas estáveis para geração (junho/2099). */
const Y = 2099;
const M = 6;

describe.skipIf(!hasDatabaseUrl)("sobreaviso — gerar, limpar, swap admin (integração)", () => {
  beforeEach(() => {
    process.env.TZ = "UTC";
    resetAuthMock();
  });

  afterEach(() => {
    resetAuthMock();
    vi.useRealTimers();
  });

  describe("generateSobreavisoForMonth / clearSobreavisoForMonth", () => {
    it("rejeita geração sem perfil de staff", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await generateSobreavisoForMonth(M, Y, null);
      expect(result).toEqual({ success: false, error: "Acesso negado." });
    });

    it("rejeita limpeza sem perfil de staff", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await clearSobreavisoForMonth(M, Y, null);
      expect(result).toEqual({ success: false, error: "Acesso negado." });
    });

    it("gera, exige limpar antes de regerar, limpa e gera de novo", async () => {
      const { team } = await createTeamWithSobreavisoMembers();
      try {
        mockResolvedSession(sessionAsAdmin());

        const gen1 = await generateSobreavisoForMonth(M, Y, team.id);
        expect(gen1.success).toBe(true);

        const countAfterFirst = await prisma.onCallAssignment.count({
          where: { member: { teamId: team.id } },
        });
        expect(countAfterFirst).toBeGreaterThan(0);

        const gen2 = await generateSobreavisoForMonth(M, Y, team.id);
        expect(gen2).toEqual({
          success: false,
          error: "Limpe o sobreaviso do mês antes de gerar novamente.",
        });

        const cleared = await clearSobreavisoForMonth(M, Y, team.id);
        expect(cleared.success).toBe(true);

        const countAfterClear = await prisma.onCallAssignment.count({
          where: { member: { teamId: team.id } },
        });
        expect(countAfterClear).toBe(0);

        const gen3 = await generateSobreavisoForMonth(M, Y, team.id);
        expect(gen3.success).toBe(true);
        expect(
          await prisma.onCallAssignment.count({
            where: { member: { teamId: team.id } },
          }),
        ).toBeGreaterThan(0);
      } finally {
        await cleanupTeamAndOnCallAssignments(team.id);
      }
    });

    it("ADMIN_TEAM gera só para a equipe gerida (resolve escopo)", async () => {
      const { team } = await createTeamWithSobreavisoMembers();
      try {
        mockResolvedSession(sessionAsAdminTeam(team.id));
        const result = await generateSobreavisoForMonth(M, Y, team.id);
        expect(result.success).toBe(true);
        const n = await prisma.onCallAssignment.count({
          where: { member: { teamId: team.id } },
        });
        expect(n).toBeGreaterThan(0);
      } finally {
        await cleanupTeamAndOnCallAssignments(team.id);
      }
    });
  });

  describe("adminSwapOnCallPositions", () => {
    it("rejeita usuário comum", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const r = await adminSwapOnCallPositions("a", "b", Y, M, null);
      expect(r).toMatchObject({
        success: false,
        error: "Apenas administradores podem realizar esta ação.",
      });
    });

    it("rejeita quando os ids são iguais", async () => {
      mockResolvedSession(sessionAsAdmin());
      const r = await adminSwapOnCallPositions("same", "same", Y, M, null);
      expect(r).toMatchObject({
        success: false,
        error: "Selecione dois membros diferentes.",
      });
    });

    it("rejeita membros de equipes diferentes", async () => {
      const t1 = await createEmptyTeam(uniqueTeamName("mops-swap1"));
      const t2 = await createEmptyTeam(uniqueTeamName("mops-swap2"));
      const tail = "11987654321";
      const a = await prisma.teamMember.create({
        data: {
          teamId: t1.id,
          name: "A",
          phone: tail,
          normalizedPhone: `55${tail}`,
          level: Level.N1,
          shift: Shift.T1,
        },
      });
      const b = await prisma.teamMember.create({
        data: {
          teamId: t2.id,
          name: "B",
          phone: "11987654322",
          normalizedPhone: "5511987654322",
          level: Level.N1,
          shift: Shift.T1,
        },
      });
      try {
        mockResolvedSession(sessionAsAdmin());
        const r = await adminSwapOnCallPositions(a.id, b.id, Y, M, null);
        expect(r).toMatchObject({
          success: false,
          error: "Os dois membros devem pertencer à mesma equipe.",
        });
      } finally {
        await prisma.teamMember.deleteMany({ where: { id: { in: [a.id, b.id] } } });
        await prisma.team.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
      }
    });

    it("ADMIN_TEAM: nega quando os membros não são da equipe gerida", async () => {
      const teamA = await createEmptyTeam(uniqueTeamName("mops-saa"));
      const teamB = await createEmptyTeam(uniqueTeamName("mops-sab"));
      const a = await prisma.teamMember.create({
        data: {
          teamId: teamA.id,
          name: "Membro A",
          phone: "11911111111",
          normalizedPhone: "5511911111111",
          level: Level.N1,
          shift: Shift.T1,
        },
      });
      const b = await prisma.teamMember.create({
        data: {
          teamId: teamA.id,
          name: "Membro B",
          phone: "11922222222",
          normalizedPhone: "5511922222222",
          level: Level.N1,
          shift: Shift.T1,
        },
      });
      try {
        mockResolvedSession(sessionAsAdminTeam(teamB.id));
        const r = await adminSwapOnCallPositions(a.id, b.id, Y, M, null);
        expect(r).toMatchObject({ success: false, error: "Acesso negado." });
      } finally {
        await prisma.teamMember.deleteMany({ where: { id: { in: [a.id, b.id] } } });
        await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } });
      }
    });

    it("troca índices de fila e assignments no intervalo (data congelada)", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2099-06-15T12:00:00.000Z"));

      const team = await createEmptyTeam(uniqueTeamName("mops-swap-ok"));
      const mA = await prisma.teamMember.create({
        data: {
          teamId: team.id,
          name: "Swap A",
          phone: "11933333333",
          normalizedPhone: "5511933333333",
          level: Level.N2,
          shift: Shift.T1,
          sobreaviso: true,
          onCallRotationIndex: 1,
        },
      });
      const mB = await prisma.teamMember.create({
        data: {
          teamId: team.id,
          name: "Swap B",
          phone: "11944444444",
          normalizedPhone: "5511944444444",
          level: Level.N2,
          shift: Shift.T1,
          sobreaviso: true,
          onCallRotationIndex: 9,
        },
      });

      const asnA = await prisma.onCallAssignment.create({
        data: {
          memberId: mA.id,
          level: Level.N2,
          startDate: new Date(Date.UTC(2099, 5, 1, 12, 0, 0)),
          endDate: new Date(Date.UTC(2099, 5, 20, 12, 0, 0)),
        },
      });
      const asnB = await prisma.onCallAssignment.create({
        data: {
          memberId: mB.id,
          level: Level.N2,
          startDate: new Date(Date.UTC(2099, 5, 10, 12, 0, 0)),
          endDate: new Date(Date.UTC(2099, 7, 1, 12, 0, 0)),
        },
      });

      try {
        mockResolvedSession(sessionAsAdmin());
        const r = await adminSwapOnCallPositions(mA.id, mB.id, Y, M, team.id);
        expect(r.success).toBe(true);

        const [aRow, bRow] = await Promise.all([
          prisma.teamMember.findUnique({
            where: { id: mA.id },
            select: { onCallRotationIndex: true },
          }),
          prisma.teamMember.findUnique({
            where: { id: mB.id },
            select: { onCallRotationIndex: true },
          }),
        ]);
        expect(aRow?.onCallRotationIndex).toBe(9);
        expect(bRow?.onCallRotationIndex).toBe(1);

        const a1 = await prisma.onCallAssignment.findUnique({ where: { id: asnA.id } });
        const b1 = await prisma.onCallAssignment.findUnique({ where: { id: asnB.id } });
        expect(a1?.memberId).toBe(mB.id);
        expect(b1?.memberId).toBe(mA.id);
      } finally {
        await prisma.onCallAssignment.deleteMany({
          where: { id: { in: [asnA.id, asnB.id] } },
        });
        await prisma.teamMember.deleteMany({ where: { id: { in: [mA.id, mB.id] } } });
        await prisma.team.deleteMany({ where: { id: team.id } });
      }
    });
  });
});

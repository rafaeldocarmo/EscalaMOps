import { lockSchedule } from "@/server/schedule/lockSchedule";
import { saveScheduleAssignments } from "@/server/schedule/saveScheduleAssignments";
import { prisma } from "@/lib/prisma";
import { AssignmentStatus } from "@/lib/generated/prisma/enums";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import {
  createMemberFixture,
  sessionAsAdmin,
  sessionAsAdminTeam,
  sessionAsPlainUser,
} from "@/tests/helpers/session-factory";
import {
  cleanupTeamCascade,
  createEmptyTeam,
  createTestSchedule,
  createTestTeamMember,
  uniqueTeamName,
} from "@/tests/helpers/team-crud-context";
import type { SaveAssignmentPayload } from "@/types/schedule";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

/** Mês fixo para asserts de intervalo (UTC estável nos testes). */
const Y = 2099;
const M = 8;
const DATE_KEY = "2099-08-15";

describe.skipIf(!hasDatabaseUrl)("lockSchedule / saveScheduleAssignments (integração)", () => {
  beforeEach(() => {
    process.env.TZ = "UTC";
    resetAuthMock();
  });

  afterEach(() => {
    resetAuthMock();
  });

  describe("lockSchedule", () => {
    it("rejeita usuário sem perfil de staff", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await lockSchedule("any");
      expect(result).toEqual({ success: false, error: "Acesso negado." });
    });

    it("rejeita ADMIN_TEAM quando a escala é de outra equipe", async () => {
      const teamA = await createEmptyTeam(uniqueTeamName("mops-sch-a"));
      const teamB = await createEmptyTeam(uniqueTeamName("mops-sch-b"));
      const sched = await createTestSchedule(teamA.id, Y, M);
      try {
        mockResolvedSession(sessionAsAdminTeam(teamB.id));
        const result = await lockSchedule(sched.id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Acesso negado.");
        }
      } finally {
        await cleanupTeamCascade(teamA.id);
        await cleanupTeamCascade(teamB.id);
      }
    });

    it("ADMIN_TEAM tranca escala da própria equipe", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-lock-team"));
      const sched = await createTestSchedule(team.id, Y, M);
      try {
        mockResolvedSession(sessionAsAdminTeam(team.id));
        const result = await lockSchedule(sched.id);
        expect(result).toEqual({ success: true });
        const row = await prisma.schedule.findUnique({
          where: { id: sched.id },
          select: { status: true },
        });
        expect(row?.status).toBe("LOCKED");
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("ADMIN tranca qualquer escala", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-lock-adm"));
      const sched = await createTestSchedule(team.id, Y, M);
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await lockSchedule(sched.id);
        expect(result).toEqual({ success: true });
        const row = await prisma.schedule.findUnique({
          where: { id: sched.id },
          select: { status: true },
        });
        expect(row?.status).toBe("LOCKED");
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("retorna erro genérico quando o id da escala não existe", async () => {
      mockResolvedSession(sessionAsAdmin());
      const result = await lockSchedule("clidsched000000000000000000");
      expect(result).toEqual({ success: false, error: "Erro ao bloquear escala." });
    });
  });

  describe("saveScheduleAssignments", () => {
    it("rejeita sem sessão", async () => {
      mockResolvedSession(null);
      const result = await saveScheduleAssignments("any", []);
      expect(result).toEqual({ success: false, error: "Acesso negado." });
    });

    it("rejeita usuário comum (não staff)", async () => {
      mockResolvedSession(sessionAsPlainUser({ member: createMemberFixture({ id: "m1" }) }));
      const result = await saveScheduleAssignments("any", []);
      expect(result).toEqual({ success: false, error: "Acesso negado." });
    });

    it("rejeita quando a escala não existe", async () => {
      mockResolvedSession(sessionAsAdmin());
      const result = await saveScheduleAssignments("clidsched000000000000000000", []);
      expect(result).toEqual({ success: false, error: "Escala não encontrada." });
    });

    it("ADMIN_TEAM: nega quando a escala é de outra equipe", async () => {
      const teamA = await createEmptyTeam(uniqueTeamName("mops-sv-a"));
      const teamB = await createEmptyTeam(uniqueTeamName("mops-sv-b"));
      const sched = await createTestSchedule(teamA.id, Y, M);
      try {
        mockResolvedSession(sessionAsAdminTeam(teamB.id));
        const result = await saveScheduleAssignments(sched.id, []);
        expect(result).toEqual({ success: false, error: "Acesso negado." });
      } finally {
        await cleanupTeamCascade(teamA.id);
        await cleanupTeamCascade(teamB.id);
      }
    });

    it("rejeita payload inválido", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-pl"));
      const sched = await createTestSchedule(team.id, Y, M);
      try {
        mockResolvedSession(sessionAsAdmin());
        const bad = await saveScheduleAssignments(sched.id, [
          { memberId: "x", date: "not-a-date", status: "OFF" },
        ] as SaveAssignmentPayload[]);
        expect(bad).toEqual({ success: false, error: "Payload inválido." });
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("persiste dias OFF e ignora WORK no createMany", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-save"));
      const sched = await createTestSchedule(team.id, Y, M);
      const member = await createTestTeamMember(team.id);
      try {
        mockResolvedSession(sessionAsAdmin());
        const payload: SaveAssignmentPayload[] = [
          { memberId: member.id, date: DATE_KEY, status: "OFF" },
          { memberId: member.id, date: "2099-08-16", status: "WORK" },
        ];
        const result = await saveScheduleAssignments(sched.id, payload);
        expect(result).toEqual({ success: true });

        const offRows = await prisma.scheduleAssignment.findMany({
          where: { scheduleId: sched.id, memberId: member.id },
        });
        expect(offRows).toHaveLength(1);
        expect(offRows[0]?.status).toBe(AssignmentStatus.OFF);
        expect(offRows[0]?.date.toISOString().startsWith(DATE_KEY)).toBe(true);
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("ADMIN_TEAM salva na própria equipe", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-sv-team"));
      const sched = await createTestSchedule(team.id, Y, M);
      const member = await createTestTeamMember(team.id);
      try {
        mockResolvedSession(sessionAsAdminTeam(team.id));
        const result = await saveScheduleAssignments(sched.id, [
          { memberId: member.id, date: DATE_KEY, status: "OFF" },
        ]);
        expect(result).toEqual({ success: true });
        const count = await prisma.scheduleAssignment.count({
          where: { scheduleId: sched.id, status: "OFF" },
        });
        expect(count).toBe(1);
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });
  });
});

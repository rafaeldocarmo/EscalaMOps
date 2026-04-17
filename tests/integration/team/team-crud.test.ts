import { createTeam } from "@/server/team/createTeam";
import { deleteTeam } from "@/server/team/deleteTeam";
import { updateTeam } from "@/server/team/updateTeam";
import { createTeamMember } from "@/server/team/createTeamMember";
import { updateTeamMember } from "@/server/team/updateTeamMember";
import { deleteTeamMember } from "@/server/team/deleteTeamMember";
import { prisma } from "@/lib/prisma";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import {
  createMemberFixture,
  sessionAsAdmin,
  sessionAsAdminTeam,
  sessionAsPlainUser,
} from "@/tests/helpers/session-factory";
import {
  buildValidMemberInput,
  cleanupTeamCascade,
  createEmptyTeam,
  createTeamWithLegacyCatalog,
  createTestSchedule,
  createTestTeamMember,
  uniqueTeamName,
} from "@/tests/helpers/team-crud-context";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

/** Input placeholder para testes que falham ANTES de tocar banco (sem team). */
const placeholderMemberInput = {
  name: "Membro Integração",
  phone: "11987654321",
  teamLevelId: "placeholder-level-id",
  teamShiftId: "placeholder-shift-id",
  sobreaviso: false,
  participatesInSchedule: true,
} as const;

describe.skipIf(!hasDatabaseUrl)("server/team — CRUD (integração)", () => {
  beforeEach(() => {
    resetAuthMock();
  });

  afterEach(() => {
    resetAuthMock();
  });

  describe("createTeam", () => {
    it("rejeita quem não é administrador global", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await createTeam({ name: "X" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Acesso negado");
      }
    });

    it("rejeita nome vazio (Zod)", async () => {
      mockResolvedSession(sessionAsAdmin());
      const result = await createTeam({ name: "" });
      expect(result.success).toBe(false);
    });

    it("cria equipe e retorna id", async () => {
      const name = uniqueTeamName("mops-ct");
      mockResolvedSession(sessionAsAdmin());
      const result = await createTeam({ name });
      expect(result).toMatchObject({ success: true });
      if (result.success) {
        expect(result.data.id).toBeTruthy();
        await cleanupTeamCascade(result.data.id);
      }
    });

    it("rejeita nome duplicado", async () => {
      const name = uniqueTeamName("mops-dup");
      const first = await createEmptyTeam(name);
      mockResolvedSession(sessionAsAdmin());
      const result = await createTeam({ name });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Já existe uma equipe com esse nome");
      }
      await cleanupTeamCascade(first.id);
    });
  });

  describe("updateTeam", () => {
    it("rejeita não admin", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await updateTeam({ id: "any", name: "Novo" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Acesso negado");
      }
    });

    it("rejeita equipe inexistente", async () => {
      mockResolvedSession(sessionAsAdmin());
      const result = await updateTeam({
        id: "clid000000000000000000000000",
        name: "Nome",
      });
      expect(result).toMatchObject({ success: false, error: "Equipe não encontrada." });
    });

    it("atualiza o nome", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-ut"));
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await updateTeam({ id: team.id, name: "Nome Atualizado CRUD" });
        expect(result).toEqual({ success: true });
        const row = await prisma.team.findUnique({
          where: { id: team.id },
          select: { name: true },
        });
        expect(row?.name).toBe("Nome Atualizado CRUD");
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("rejeita nome duplicado de outra equipe", async () => {
      const nameA = uniqueTeamName("mops-a");
      const nameB = uniqueTeamName("mops-b");
      const teamA = await createEmptyTeam(nameA);
      const teamB = await createEmptyTeam(nameB);
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await updateTeam({ id: teamB.id, name: nameA });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("Já existe uma equipe com esse nome");
        }
      } finally {
        await cleanupTeamCascade(teamA.id);
        await cleanupTeamCascade(teamB.id);
      }
    });
  });

  describe("deleteTeam", () => {
    it("rejeita não admin", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await deleteTeam({ id: "any" });
      expect(result.success).toBe(false);
    });

    it("rejeita id inválido", async () => {
      mockResolvedSession(sessionAsAdmin());
      const result = await deleteTeam({ id: "" });
      expect(result.success).toBe(false);
    });

    it("rejeita equipe inexistente", async () => {
      mockResolvedSession(sessionAsAdmin());
      const result = await deleteTeam({ id: "clid000000000000000000000000" });
      expect(result).toMatchObject({ success: false, error: "Equipe não encontrada." });
    });

    it("rejeita quando há membros", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-mem"));
      const member = await createTestTeamMember(team.id);
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await deleteTeam({ id: team.id });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("membros");
        }
      } finally {
        await prisma.teamMember.deleteMany({ where: { id: member.id } });
        await cleanupTeamCascade(team.id);
      }
    });

    it("rejeita quando há escala cadastrada", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-sch"));
      const sched = await createTestSchedule(team.id, 2098, 3);
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await deleteTeam({ id: team.id });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("escalas");
        }
      } finally {
        await prisma.schedule.deleteMany({ where: { id: sched.id } });
        await cleanupTeamCascade(team.id);
      }
    });

    it("remove equipe vazia quando existe outra equipe no banco", async () => {
      const keeper = await createEmptyTeam(uniqueTeamName("mops-keep"));
      const victim = await createEmptyTeam(uniqueTeamName("mops-victim"));
      try {
        const countBefore = await prisma.team.count();
        expect(countBefore).toBeGreaterThanOrEqual(2);
        mockResolvedSession(sessionAsAdmin());
        const result = await deleteTeam({ id: victim.id });
        expect(result).toEqual({ success: true });
        const gone = await prisma.team.findUnique({ where: { id: victim.id } });
        expect(gone).toBeNull();
      } finally {
        await cleanupTeamCascade(keeper.id);
      }
    });
  });

  describe("createTeamMember", () => {
    it("rejeita usuário sem perfil de staff", async () => {
      mockResolvedSession(sessionAsPlainUser({ member: createMemberFixture({ id: "m1" }) }));
      const result = await createTeamMember(placeholderMemberInput, { teamId: "any" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Acesso negado");
      }
    });

    it("rejeita telefone inválido (Zod)", async () => {
      const { team } = await createTeamWithLegacyCatalog(uniqueTeamName("mops-tel"));
      try {
        mockResolvedSession(sessionAsAdmin());
        const input = await buildValidMemberInput(team.id, { phone: "123" });
        const result = await createTeamMember(input, { teamId: team.id });
        expect(result.success).toBe(false);
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("cria membro com ADMIN e teamId explícito", async () => {
      const { team } = await createTeamWithLegacyCatalog(uniqueTeamName("mops-cm"));
      try {
        mockResolvedSession(sessionAsAdmin());
        const input = await buildValidMemberInput(team.id);
        const result = await createTeamMember(input, { teamId: team.id });
        expect(result).toMatchObject({ success: true });
        if (result.success) {
          const m = await prisma.teamMember.findUnique({
            where: { id: result.data.id },
            select: { teamId: true, name: true },
          });
          expect(m?.teamId).toBe(team.id);
          expect(m?.name).toBe(input.name);
        }
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("ADMIN_TEAM: cria membro na equipe gerida", async () => {
      const { team } = await createTeamWithLegacyCatalog(uniqueTeamName("mops-admteam"));
      try {
        mockResolvedSession(sessionAsAdminTeam(team.id));
        const input = await buildValidMemberInput(team.id);
        const result = await createTeamMember(input);
        expect(result).toMatchObject({ success: true });
        if (result.success) {
          const m = await prisma.teamMember.findUnique({
            where: { id: result.data.id },
            select: { teamId: true },
          });
          expect(m?.teamId).toBe(team.id);
        }
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });
  });

  describe("updateTeamMember / deleteTeamMember", () => {
    it("rejeita edição sem staff", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const r = await updateTeamMember("any", placeholderMemberInput);
      expect(r.success).toBe(false);
    });

    it("ADMIN_TEAM: nega edição de membro de outra equipe", async () => {
      const { team: teamA } = await createTeamWithLegacyCatalog(uniqueTeamName("mops-ta"));
      const { team: teamB } = await createTeamWithLegacyCatalog(uniqueTeamName("mops-tb"));
      const memberOnA = await createTestTeamMember(teamA.id);
      try {
        mockResolvedSession(sessionAsAdminTeam(teamB.id));
        const input = await buildValidMemberInput(teamB.id, { name: "Tentativa" });
        const result = await updateTeamMember(memberOnA.id, input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("não pertence à sua equipe");
        }
      } finally {
        await cleanupTeamCascade(teamA.id);
        await cleanupTeamCascade(teamB.id);
      }
    });

    it("ADMIN_TEAM: permite editar membro da própria equipe", async () => {
      const { team } = await createTeamWithLegacyCatalog(uniqueTeamName("mops-edit"));
      const member = await createTestTeamMember(team.id);
      try {
        mockResolvedSession(sessionAsAdminTeam(team.id));
        const input = await buildValidMemberInput(team.id, { name: "Nome Editado" });
        const result = await updateTeamMember(member.id, input);
        expect(result).toEqual({ success: true });
        const row = await prisma.teamMember.findUnique({
          where: { id: member.id },
          select: { name: true },
        });
        expect(row?.name).toBe("Nome Editado");
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("ADMIN: remove membro", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-del-m"));
      const member = await createTestTeamMember(team.id);
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await deleteTeamMember(member.id);
        expect(result).toEqual({ success: true });
        const gone = await prisma.teamMember.findUnique({ where: { id: member.id } });
        expect(gone).toBeNull();
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("ADMIN_TEAM: nega exclusão de membro de outra equipe", async () => {
      const teamA = await createEmptyTeam(uniqueTeamName("mops-da"));
      const teamB = await createEmptyTeam(uniqueTeamName("mops-db"));
      const memberOnA = await createTestTeamMember(teamA.id);
      try {
        mockResolvedSession(sessionAsAdminTeam(teamB.id));
        const result = await deleteTeamMember(memberOnA.id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("não pertence à sua equipe");
        }
      } finally {
        await prisma.teamMember.deleteMany({ where: { id: memberOnA.id } });
        await cleanupTeamCascade(teamA.id);
        await cleanupTeamCascade(teamB.id);
      }
    });
  });
});

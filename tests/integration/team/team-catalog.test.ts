import { prisma } from "@/lib/prisma";
import { createTeamMember } from "@/server/team/createTeamMember";
import { createTeamLevel } from "@/server/team/createTeamLevel";
import { createTeamShift } from "@/server/team/createTeamShift";
import { deleteTeamLevel } from "@/server/team/deleteTeamLevel";
import { deleteTeamShift } from "@/server/team/deleteTeamShift";
import { getTeamLevelShiftCatalog } from "@/server/team/getTeamLevelShiftCatalog";
import { replaceAllowedShiftsForTeamLevel } from "@/server/team/replaceAllowedShiftsForTeamLevel";
import { updateTeamLevel } from "@/server/team/updateTeamLevel";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import { sessionAsAdmin, sessionAsAdminTeam, sessionAsPlainUser } from "@/tests/helpers/session-factory";
import { cleanupTeamCascade, createEmptyTeam, uniqueTeamName } from "@/tests/helpers/team-crud-context";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDatabaseUrl)("server/team — catálogo nível/turno (integração)", () => {
  beforeEach(() => {
    resetAuthMock();
  });

  afterEach(() => {
    resetAuthMock();
  });

  describe("getTeamLevelShiftCatalog", () => {
    it("rejeita usuário sem privilégio de staff", async () => {
      mockResolvedSession(sessionAsPlainUser());
      const result = await getTeamLevelShiftCatalog();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Acesso negado");
      }
    });

    it("retorna listas vazias quando ainda não há catálogo", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-cat"));
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await getTeamLevelShiftCatalog(team.id);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.teamId).toBe(team.id);
          expect(result.data.levels).toEqual([]);
          expect(result.data.shifts).toEqual([]);
          expect(result.data.allowedPairs).toEqual([]);
        }
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });
  });

  describe("CRUD + matriz", () => {
    it("cria nível, turno, substitui vínculos e lista", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-cat-crud"));
      try {
        mockResolvedSession(sessionAsAdmin());

        const l = await createTeamLevel({
          teamId: team.id,
          label: "Nível 1",
        });
        const s = await createTeamShift({
          teamId: team.id,
          label: "Turno 1",
        });
        expect(l.success).toBe(true);
        expect(s.success).toBe(true);
        if (!l.success || !s.success) return;

        const rep = await replaceAllowedShiftsForTeamLevel({
          teamLevelId: l.data.id,
          teamShiftIds: [s.data.id],
        });
        expect(rep.success).toBe(true);

        const catalog = await getTeamLevelShiftCatalog(team.id);
        expect(catalog.success).toBe(true);
        if (catalog.success) {
          expect(catalog.data.levels).toHaveLength(1);
          expect(catalog.data.shifts).toHaveLength(1);
          expect(catalog.data.allowedPairs).toEqual([
            { teamLevelId: l.data.id, teamShiftId: s.data.id },
          ]);
        }

        const upd = await updateTeamLevel({
          id: l.data.id,
          label: "Nível 1 atualizado",
        });
        expect(upd.success).toBe(true);

        await deleteTeamLevel(l.data.id);
        await deleteTeamShift(s.data.id);

        const after = await getTeamLevelShiftCatalog(team.id);
        expect(after.success).toBe(true);
        if (after.success) {
          expect(after.data.levels).toHaveLength(0);
          expect(after.data.shifts).toHaveLength(0);
        }
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("com catálogo: bloqueia combinação fora da matriz", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-mat"));
      try {
        const l = await prisma.teamLevel.create({
          data: {
            teamId: team.id,
            label: "N1",
            sortOrder: 0,
          },
        });
        const s1 = await prisma.teamShift.create({
          data: {
            teamId: team.id,
            label: "T1",
            sortOrder: 0,
          },
        });
        await prisma.teamShift.create({
          data: {
            teamId: team.id,
            label: "T2",
            sortOrder: 1,
          },
        });
        await prisma.teamLevelAllowedShift.create({
          data: { teamLevelId: l.id, teamShiftId: s1.id },
        });

        const s2 = await prisma.teamShift.findFirst({
          where: { teamId: team.id, label: "T2" },
          select: { id: true },
        });

        mockResolvedSession(sessionAsAdmin());
        const bad = await createTeamMember(
          {
            name: "Teste Matriz",
            phone: "11988776655",
            teamLevelId: l.id,
            teamShiftId: s2!.id,
            sobreaviso: false,
            participatesInSchedule: true,
          },
          { teamId: team.id },
        );
        expect(bad.success).toBe(false);
        if (!bad.success) {
          expect(bad.error).toContain("não é permitida");
        }

        const good = await createTeamMember(
          {
            name: "Teste OK",
            phone: "11988776644",
            teamLevelId: l.id,
            teamShiftId: s1.id,
            sobreaviso: false,
            participatesInSchedule: true,
          },
          { teamId: team.id },
        );
        expect(good.success).toBe(true);
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });

    it("ADMIN_TEAM só enxerga a própria equipe no catálogo", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-cat-scope"));
      try {
        await prisma.teamLevel.create({
          data: {
            teamId: team.id,
            label: "Nível X",
            sortOrder: 0,
          },
        });

        mockResolvedSession(sessionAsAdminTeam(team.id));
        const result = await getTeamLevelShiftCatalog();
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.teamId).toBe(team.id);
          expect(result.data.levels.some((x) => x.label === "Nível X")).toBe(true);
        }
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });
  });

  describe("validação de membros (M4)", () => {
    it("sem catálogo na equipe: bloqueia criação (não há nível/turno válido)", async () => {
      const team = await createEmptyTeam(uniqueTeamName("mops-legacy"));
      try {
        mockResolvedSession(sessionAsAdmin());
        const result = await createTeamMember(
          {
            name: "Legado N2T3",
            phone: "11977665544",
            teamLevelId: "nao-existe",
            teamShiftId: "tambem-nao",
            sobreaviso: false,
            participatesInSchedule: true,
          },
          { teamId: team.id },
        );
        expect(result.success).toBe(false);
      } finally {
        await cleanupTeamCascade(team.id);
      }
    });
  });
});

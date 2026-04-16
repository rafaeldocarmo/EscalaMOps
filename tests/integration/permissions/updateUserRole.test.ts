import { updateUserRole } from "@/server/permissions/updateUserRole";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/generated/prisma/enums";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import {
  createMemberFixture,
  sessionAsAdmin,
  sessionAsAdminTeam,
  sessionAsPlainUser,
} from "@/tests/helpers/session-factory";
import {
  createPermissionTestTeam,
  createPermissionTestUser,
  deletePermissionTestTeam,
  deletePermissionTestUser,
} from "@/tests/helpers/permissions-user-context";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDatabaseUrl)("updateUserRole (integração)", () => {
  beforeEach(() => {
    resetAuthMock();
  });

  afterEach(() => {
    resetAuthMock();
  });

  it("rejeita quem não é administrador global (USER)", async () => {
    mockResolvedSession(
      sessionAsPlainUser({ member: createMemberFixture({ id: "m1" }) }),
    );
    const result = await updateUserRole({
      userId: "any",
      role: "ADMIN",
    });
    expect(result).toEqual({
      success: false,
      error: "Apenas administradores podem alterar permissões.",
    });
  });

  it("rejeita ADMIN_TEAM (somente role ADMIN é admin global)", async () => {
    mockResolvedSession(
      sessionAsAdminTeam("team-any"),
    );
    const result = await updateUserRole({
      userId: "any",
      role: "USER",
    });
    expect(result).toEqual({
      success: false,
      error: "Apenas administradores podem alterar permissões.",
    });
  });

  it("rejeita payload inválido (schema Zod)", async () => {
    mockResolvedSession(sessionAsAdmin());
    const badRole = await updateUserRole({ userId: "x", role: "INVALID" } as never);
    expect(badRole).toEqual({ success: false, error: "Dados inválidos." });

    const emptyId = await updateUserRole({
      userId: "",
      role: "ADMIN",
    });
    expect(emptyId).toEqual({ success: false, error: "Dados inválidos." });
  });

  it("rejeita quando o usuário alvo não existe", async () => {
    mockResolvedSession(sessionAsAdmin());
    const result = await updateUserRole({
      userId: "clid000000000000000000000000",
      role: "USER",
    });
    expect(result).toEqual({ success: false, error: "Usuário não encontrado." });
  });

  it("rejeita alteração do administrador global (isGlobalAdmin)", async () => {
    // O schema costuma ter no máximo um `is_global_admin=true` (constraint única); usamos o já existente no banco.
    const globalUser = await prisma.user.findFirst({
      where: { isGlobalAdmin: true },
      select: { id: true },
    });
    expect(
      globalUser,
      "É necessário um usuário com is_global_admin no banco (ex.: seed) para validar esta regra.",
    ).not.toBeNull();

    mockResolvedSession(sessionAsAdmin());
    const result = await updateUserRole({
      userId: globalUser!.id,
      role: "USER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("administrador global");
    }
  });

  it("exige managedTeamId ao promover para ADMIN_TEAM", async () => {
    const team = await createPermissionTestTeam();
    const suffix = Date.now().toString(36);
    const target = await createPermissionTestUser({
      email: `perm-user-${suffix}@test.local`,
      role: UserRole.USER,
    });
    try {
      mockResolvedSession(sessionAsAdmin());

      const semEquipe = await updateUserRole({
        userId: target.id,
        role: "ADMIN_TEAM",
      });
      expect(semEquipe).toEqual({
        success: false,
        error: "Selecione a equipe para o perfil de administrador de equipe.",
      });

      const equipeVazia = await updateUserRole({
        userId: target.id,
        role: "ADMIN_TEAM",
        managedTeamId: "   ",
      });
      expect(equipeVazia.success).toBe(false);
      expect(equipeVazia).toMatchObject({
        success: false,
        error: "Selecione a equipe para o perfil de administrador de equipe.",
      });

      const ok = await updateUserRole({
        userId: target.id,
        role: "ADMIN_TEAM",
        managedTeamId: team.id,
      });
      expect(ok).toEqual({ success: true });

      const updated = await prisma.user.findUnique({
        where: { id: target.id },
        select: { role: true, managedTeamId: true },
      });
      expect(updated?.role).toBe("ADMIN_TEAM");
      expect(updated?.managedTeamId).toBe(team.id);
    } finally {
      await deletePermissionTestUser(target.id);
      await deletePermissionTestTeam(team.id);
    }
  });

  it("promove usuário a ADMIN e zera managedTeamId", async () => {
    const suffix = Date.now().toString(36);
    const team = await createPermissionTestTeam();
    const target = await createPermissionTestUser({
      email: `perm-promote-${suffix}@test.local`,
      role: UserRole.ADMIN_TEAM,
      managedTeamId: team.id,
    });
    try {
      mockResolvedSession(sessionAsAdmin());
      const result = await updateUserRole({
        userId: target.id,
        role: "ADMIN",
      });
      expect(result).toEqual({ success: true });
      const updated = await prisma.user.findUnique({
        where: { id: target.id },
        select: { role: true, managedTeamId: true },
      });
      expect(updated?.role).toBe("ADMIN");
      expect(updated?.managedTeamId).toBeNull();
    } finally {
      await deletePermissionTestUser(target.id);
      await deletePermissionTestTeam(team.id);
    }
  });

  it("rebaixa para USER e remove equipe gerida", async () => {
    const suffix = Date.now().toString(36);
    const team = await createPermissionTestTeam();
    const target = await createPermissionTestUser({
      email: `perm-down-${suffix}@test.local`,
      role: UserRole.ADMIN_TEAM,
      managedTeamId: team.id,
    });
    try {
      mockResolvedSession(sessionAsAdmin());
      const result = await updateUserRole({
        userId: target.id,
        role: "USER",
      });
      expect(result).toEqual({ success: true });
      const updated = await prisma.user.findUnique({
        where: { id: target.id },
        select: { role: true, managedTeamId: true },
      });
      expect(updated?.role).toBe("USER");
      expect(updated?.managedTeamId).toBeNull();
    } finally {
      await deletePermissionTestUser(target.id);
      await deletePermissionTestTeam(team.id);
    }
  });

  it("retorna erro genérico quando managedTeamId não existe (FK)", async () => {
    const suffix = Date.now().toString(36);
    const target = await createPermissionTestUser({
      email: `perm-fk-${suffix}@test.local`,
      role: UserRole.USER,
    });
    try {
      mockResolvedSession(sessionAsAdmin());
      const result = await updateUserRole({
        userId: target.id,
        role: "ADMIN_TEAM",
        managedTeamId: "clidteam00000000000000000000",
      });
      expect(result).toEqual({
        success: false,
        error: "Não foi possível salvar.",
      });
    } finally {
      await deletePermissionTestUser(target.id);
    }
  });
});

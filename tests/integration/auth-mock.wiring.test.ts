import { auth } from "@/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthMock, mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import {
  createMemberFixture,
  sessionAsAdmin,
  sessionAsAdminTeam,
  sessionAsPlainUser,
} from "@/tests/helpers/session-factory";

describe("Etapa 2 — mock global de auth() e factories de sessão", () => {
  beforeEach(() => {
    resetAuthMock();
  });

  it("export auth de @/auth é vi.fn (substituído no setup)", () => {
    expect(vi.isMockFunction(auth)).toBe(true);
  });

  it("mockResolvedSession define o retorno de auth()", async () => {
    mockResolvedSession(null);
    await expect(auth()).resolves.toBeNull();

    const session = sessionAsPlainUser();
    mockResolvedSession(session);
    await expect(auth()).resolves.toEqual(session);
  });

  it("getAuthMock expõe chamadas ao auth()", async () => {
    mockResolvedSession(sessionAsAdmin());
    await auth();
    await auth();
    expect(getAuthMock()).toHaveBeenCalledTimes(2);
  });

  it("presets: USER, ADMIN e ADMIN_TEAM com managedTeamId", () => {
    const user = sessionAsPlainUser();
    expect(user.user.role).toBe("USER");
    expect(user.user.managedTeamId).toBeNull();

    const admin = sessionAsAdmin();
    expect(admin.user.role).toBe("ADMIN");

    const teamAdmin = sessionAsAdminTeam("team-seed-1");
    expect(teamAdmin.user.role).toBe("ADMIN_TEAM");
    expect(teamAdmin.user.managedTeamId).toBe("team-seed-1");
  });

  it("createMemberFixture produz membro determinístico", () => {
    const m = createMemberFixture({ id: "m-custom", level: "N2" });
    expect(m.id).toBe("m-custom");
    expect(m.level).toBe("N2");
    expect(m.shift).toBe("T1");
  });
});

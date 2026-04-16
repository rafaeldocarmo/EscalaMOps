import type { Session } from "next-auth";
import type { SessionMember } from "@/types/next-auth";

function expiresInOneWeek(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function createMemberFixture(overrides: Partial<SessionMember> = {}): SessionMember {
  return {
    id: "member-test-1",
    name: "Membro Teste",
    phone: "11987654321",
    level: "N1",
    shift: "T1",
    ...overrides,
  };
}

type SessionUserPartial = Partial<Session["user"]> & Pick<Session["user"], "id">;

/**
 * Monta um objeto `Session` compatível com as extensões em `types/next-auth.d.ts`.
 * IDs e emails são fixos para manter testes determinísticos.
 */
export function createSessionFixture(options: {
  user: SessionUserPartial;
  member?: SessionMember | null;
}): Session {
  const { user: userPartial, member = null } = options;

  const user = {
    email: "user@test.local",
    name: "Usuário Teste",
    phone: null as string | null,
    role: "USER" as string | null,
    managedTeamId: null as string | null,
    ...userPartial,
  };

  return {
    expires: expiresInOneWeek(),
    user: user as Session["user"],
    member,
  };
}

/** Usuário comum autenticado, sem vínculo de membro (celular). */
export function sessionAsPlainUser(overrides: { user?: Partial<Session["user"]>; member?: SessionMember | null } = {}) {
  return createSessionFixture({
    user: {
      id: "user-plain-1",
      role: "USER",
      ...overrides.user,
    },
    member: overrides.member !== undefined ? overrides.member : null,
  });
}

/** ADMIN global (equipes e permissões amplas nos guards do app). */
export function sessionAsAdmin(overrides: { user?: Partial<Session["user"]>; member?: SessionMember | null } = {}) {
  return createSessionFixture({
    user: {
      id: "user-admin-1",
      role: "ADMIN",
      managedTeamId: null,
      ...overrides.user,
    },
    member: overrides.member !== undefined ? overrides.member : null,
  });
}

/** ADMIN_TEAM: gestor restrito a uma equipe (`managedTeamId`). */
export function sessionAsAdminTeam(
  managedTeamId: string,
  overrides: { user?: Partial<Session["user"]>; member?: SessionMember | null } = {},
) {
  return createSessionFixture({
    user: {
      id: "user-admin-team-1",
      role: "ADMIN_TEAM",
      managedTeamId,
      ...overrides.user,
    },
    member: overrides.member !== undefined ? overrides.member : null,
  });
}

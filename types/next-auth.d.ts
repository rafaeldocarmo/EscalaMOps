import type { DefaultSession } from "next-auth";

export interface SessionMember {
  id: string;
  name: string;
  phone: string;
  /** Enum legado derivado de TeamLevel.legacyKind. NULL quando é catálogo personalizado. */
  level: string | null;
  /** Enum legado derivado de TeamShift.legacyKind. NULL quando é catálogo personalizado. */
  shift: string | null;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email: string | null;
      phone?: string | null;
      role?: string | null;
      /** Set when role is ADMIN_TEAM: the only team this account may access. */
      managedTeamId?: string | null;
    } & Omit<DefaultSession["user"], "id" | "email">;
    member?: SessionMember | null;
  }

  interface User {
    id: string;
    phone?: string | null;
    role?: string | null;
    managedTeamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    managedTeamId?: string | null;
    member?: SessionMember | null;
  }
}

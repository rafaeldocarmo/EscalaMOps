import type { DefaultSession } from "next-auth";

export interface SessionMember {
  id: string;
  name: string;
  level: string;
  shift: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email: string | null;
      phone?: string | null;
      role?: string | null;
    } & Omit<DefaultSession["user"], "id" | "email">;
    member?: SessionMember | null;
  }

  interface User {
    id: string;
    phone?: string | null;
    role?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    member?: SessionMember | null;
  }
}

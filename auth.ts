import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { signInSchema } from "@/lib/validations/auth";
import bcrypt from "bcryptjs";
import type { Adapter } from "next-auth/adapters";

const secret = process.env.AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET is required in production");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedEmail || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          phone: user.phone ?? null,
          role: user.role ?? undefined,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  secret,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        token.phone = (user as { phone?: string | null }).phone ?? undefined;
        let role = (user as { role?: string | null }).role ?? undefined;
        if (role === undefined && user.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          });
          role = dbUser?.role ?? undefined;
        }
        token.role = role;
      }
      if (trigger === "update" && session) {
        if (session.phone !== undefined) token.phone = session.phone;
        if (session.role !== undefined) token.role = session.role;
        if (session.member !== undefined) token.member = session.member;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const rawId = token.id ?? token.sub;
        session.user.id = typeof rawId === "string" ? rawId : "";
        const email = (token.email as string | null | undefined) ?? null;
        const phone = (token.phone as string | null | undefined) ?? null;
        const role = (token.role as string | null | undefined) ?? null;
        Object.assign(session.user, { email, phone, role });
      }
      session.member = (token.member as typeof session.member) ?? null;
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development" && !!process.env.AUTH_DEBUG,
};

export function auth() {
  return getServerSession(authOptions);
}

export const nextAuthHandler = NextAuth(authOptions);

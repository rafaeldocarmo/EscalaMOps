import { vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
  })),
}));

/**
 * Substitui `auth()` de `@/auth` por um `vi.fn()` em todos os testes.
 * Em arquivos de integração, use `getAuthMock()` + `mockResolvedSession(...)` (ver `tests/helpers/auth-mock.ts`).
 */
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/whatsapp/sendWhatsappMessage", () => ({
  sendWhatsappMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/multiTeam", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/multiTeam")>();
  return {
    ...mod,
    resolveTeamIdForRead: vi.fn().mockResolvedValue(null),
  };
});

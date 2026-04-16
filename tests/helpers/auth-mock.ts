import type { Session } from "next-auth";
import { auth } from "@/auth";
import { vi } from "vitest";

export function getAuthMock() {
  return vi.mocked(auth);
}

/** Define o retorno de `auth()` na próxima chamada (e por padrão nas seguintes, até novo `mockResolvedValue`). */
export function mockResolvedSession(session: Session | null) {
  getAuthMock().mockResolvedValue(session);
}

export function resetAuthMock() {
  getAuthMock().mockReset();
}

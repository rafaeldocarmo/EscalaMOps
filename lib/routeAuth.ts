import { NextResponse } from "next/server";
import { auth } from "@/auth";

export function withAuth<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
  opts?: { requireAdmin?: boolean }
) {
  return async (...args: TArgs): Promise<Response> => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (opts?.requireAdmin && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return handler(...args);
  };
}


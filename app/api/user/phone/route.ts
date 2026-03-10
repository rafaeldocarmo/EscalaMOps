import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { phoneSchema } from "@/lib/validations/auth";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = phoneSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "form";
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return NextResponse.json(
        { error: fieldErrors },
        { status: 400 }
      );
    }

    const phone = parsed.data.phone.replace(/\D/g, "").trim();
    if (phone.length < 10) {
      return NextResponse.json(
        { error: { phone: ["Número inválido. Use DDD + número."] } },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone: parsed.data.phone },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar número. Tente novamente." },
      { status: 500 }
    );
  }
}

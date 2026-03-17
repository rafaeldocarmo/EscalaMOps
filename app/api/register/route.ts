import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signUpSchema } from "@/lib/validations/auth";
import { registerRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const { success } = await registerRateLimit.limit(`ip:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde e tente novamente." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = signUpSchema.safeParse(body);
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

    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: { email: ["Este email já está em uso."] } },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar conta. Tente novamente." },
      { status: 500 }
    );
  }
}

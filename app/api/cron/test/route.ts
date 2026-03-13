import { NextResponse } from "next/server";
import { sendDailyScheduleSummary } from "@/server/whatsapp/sendDailyScheduleSummary";

/**
 * Rota só para teste local: dispara o envio da escala do dia.
 * Só funciona em desenvolvimento e com CRON_SECRET no .env (mesmo valor do header).
 * Exemplo: GET /api/cron/test com header Authorization: Bearer SEU_CRON_SECRET
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not available in production", { status: 404 });
  }

  const auth = request.headers.get("Authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized. Use: Authorization: Bearer <CRON_SECRET>", {
      status: 401,
    });
  }

  try {
    await sendDailyScheduleSummary();
    return NextResponse.json({ ok: true, message: "Mensagem enviada." });
  } catch (error) {
    console.error("Cron test error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

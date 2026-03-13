import { NextResponse } from "next/server";
import { sendDailyScheduleSummary } from "@/server/whatsapp/sendDailyScheduleSummary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("Authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await sendDailyScheduleSummary();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cron daily schedule error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

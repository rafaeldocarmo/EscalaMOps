import { NextResponse } from "next/server";
import { getTodaySummary } from "@/server/integrations/alexa/getTodaySummary";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = request.headers.get("Authorization");
  const expected = process.env.ALEXA_INTEGRATION_TOKEN;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const summary = await getTodaySummary();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


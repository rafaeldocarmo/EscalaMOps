import { NextResponse } from "next/server";
import {
  getRequestApplicationId,
  handleAlexaSkillRequest,
} from "@/lib/alexa/handleAlexaSkillRequest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const runtime = "nodejs";

function getHeader(request: Request, ...names: string[]): string | null {
  for (const name of names) {
    const v = request.headers.get(name);
    if (v) return v;
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!rawBody) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const skipVerify = process.env.ALEXA_SKIP_SKILL_SIGNATURE_VERIFY === "true";
  if (!skipVerify) {
    const certUrl = getHeader(
      request,
      "SignatureCertChainUrl",
      "signaturecertchainurl",
    );
    const signature = getHeader(request, "Signature", "signature");
    try {
      const alexaVerifier = (await import("alexa-verifier")).default;
      await alexaVerifier(certUrl, signature, rawBody);
    } catch {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody) as unknown;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  if (!envelope || typeof envelope !== "object" || !("request" in envelope)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const expectedSkillId = process.env.ALEXA_SKILL_ID?.trim();
  if (expectedSkillId) {
    const appId = getRequestApplicationId(envelope as Parameters<typeof getRequestApplicationId>[0]);
    if (appId !== expectedSkillId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const responseBody = await handleAlexaSkillRequest(
    envelope as Parameters<typeof handleAlexaSkillRequest>[0],
  );

  return NextResponse.json(responseBody, {
    headers: { "Content-Type": "application/json;charset=UTF-8" },
  });
}

export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

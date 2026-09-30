import "server-only";
import { NextResponse } from "next/server";
import { getClassifier } from "@/lib/classifier";
import { SmsCheckRequestSchema, type SmsCheckResponse } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const HEADERS = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

export async function POST(req: Request) {
  // startsWith (not includes): "text/plain; x=application/json" must be rejected.
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail("Ongeldig verzoek.", 415);
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail("Ongeldig verzoek.", 413);

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return fail("Ongeldig verzoek.", 413);
    raw = JSON.parse(text);
  } catch {
    return fail("Ongeldig verzoek.", 400);
  }
  const parsed = SmsCheckRequestSchema.safeParse(raw);
  if (!parsed.success) return fail("Ongeldig verzoek.", 400);
  const started = Date.now();
  try {
    const verdict: SmsCheckResponse = await getClassifier().judgeSms(parsed.data.text);
    console.info(`[sms] verdict=${verdict.verdict} latencyMs=${Date.now() - started}`);
    return NextResponse.json(verdict, { headers: HEADERS });
  } catch {
    console.error("[sms] error");
    return fail("Er ging iets mis.", 500);
  }
}

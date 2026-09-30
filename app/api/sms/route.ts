import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getClassifier } from "@/lib/classifier";
import { SmsCheckRequestSchema, type SmsCheckResponse } from "@/lib/contracts";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const bad = () => NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400, headers: HEADERS });

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) return bad();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad();
  }
  const parsed = SmsCheckRequestSchema.safeParse(raw);
  if (!parsed.success) return bad();
  const started = Date.now();
  try {
    const verdict: SmsCheckResponse = await getClassifier().judgeSms(parsed.data.text);
    console.info(`[sms] verdict=${verdict.verdict} latencyMs=${Date.now() - started}`);
    return NextResponse.json(verdict, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Er ging iets mis." }, { status: 500, headers: HEADERS });
  }
}

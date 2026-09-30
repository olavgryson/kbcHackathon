import "server-only";
import { NextResponse } from "next/server";
import { ChatRequestSchema } from "@/lib/contracts";
import { runChat } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 30 * 1024;
const HEADERS = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail("Ongeldige invoer.", 415);
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail("Ongeldige invoer.", 413);

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail("Ongeldige invoer.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("Ongeldige invoer.", 400);
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) return fail("Ongeldige invoer.", 400);

  try {
    const result = await runChat(parsed.data);
    return NextResponse.json(result, { headers: HEADERS });
  } catch {
    console.error("[chat] error");
    return fail("Er ging iets mis. Probeer het later opnieuw.", 500);
  }
}

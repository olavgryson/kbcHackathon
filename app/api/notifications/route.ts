import "server-only";
import { NextResponse } from "next/server";
import { getClassifier } from "@/lib/classifier";
import type { NotificationsResponse } from "@/lib/contracts";
import { DEMO_CUSTOMER_ID } from "@/lib/data";
import { getSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const signals = await getSignals(DEMO_CUSTOMER_ID, getClassifier());
    const body: NotificationsResponse = {
      notifications: signals.filter((s) => s.notify),
      candidates: signals.length,
    };
    return NextResponse.json(body, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Er ging iets mis." }, { status: 500, headers: HEADERS });
  }
}

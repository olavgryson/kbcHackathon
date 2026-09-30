import type { ChatResponse, NotificationsResponse, SmsCheckResponse } from "@/lib/contracts";

export const GENERIC_ERROR = "Er ging iets mis. Probeer het opnieuw.";
export const RATE_LIMIT_ERROR = "Even geduld, te veel verzoeken.";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isChatResponse(v: unknown): v is ChatResponse {
  return (
    isObj(v) &&
    typeof v.reply === "string" &&
    isObj(v.meta) &&
    (v.meta.mode === "baseline" || v.meta.mode === "plus") &&
    typeof v.meta.inputTokens === "number" &&
    typeof v.meta.latencyMs === "number" &&
    typeof v.meta.model === "string" &&
    Array.isArray(v.meta.interventions)
  );
}

export function isNotificationsResponse(v: unknown): v is NotificationsResponse {
  return isObj(v) && Array.isArray(v.notifications) && typeof v.candidates === "number";
}

export function isSmsResponse(v: unknown): v is SmsCheckResponse {
  return (
    isObj(v) &&
    (v.verdict === "phishing" || v.verdict === "verdacht" || v.verdict === "veilig") &&
    typeof v.score === "number" &&
    Array.isArray(v.reasons)
  );
}

async function request<T>(
  url: string,
  init: RequestInit,
  guard: (v: unknown) => v is T,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return { ok: false, error: res.status === 429 ? RATE_LIMIT_ERROR : GENERIC_ERROR };
    const data: unknown = await res.json();
    if (!guard(data)) return { ok: false, error: GENERIC_ERROR };
    return { ok: true, data };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export function postJson<T>(url: string, body: unknown, guard: (v: unknown) => v is T) {
  return request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, guard);
}

export function getJson<T>(url: string, guard: (v: unknown) => v is T) {
  return request(url, { method: "GET" }, guard);
}

export function shortModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "Haiku";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("router")) return "router";
  if (m.includes("demo")) return "demo";
  return model.slice(0, 20);
}

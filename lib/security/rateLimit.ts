// Demo-level in-memory token bucket per IP. Not shared across instances and
// reset on restart; see SECURITY.md (known limitations).

type Bucket = { tokens: number; updatedAt: number };

const CAPACITY = 30;
const REFILL_PER_SECOND = 0.5;
const MAX_TRACKED_KEYS = 5000;

const buckets = new Map<string, Bucket>();

export function takeToken(key: string, now: number = Date.now()): boolean {
  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? { tokens: CAPACITY, updatedAt: now };
  const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);
  bucket.updatedAt = now;

  if (!existing) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      const oldest = buckets.keys().next();
      if (!oldest.done) buckets.delete(oldest.value);
    }
    buckets.set(key, bucket);
  }

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export function clientKey(forwardedFor: string | null, realIp: string | null): string {
  // Only take the first hop and bound its length; the header is client-controlled.
  const first = (forwardedFor ?? "").split(",")[0]?.trim().slice(0, 64);
  return first || realIp?.trim().slice(0, 64) || "local";
}

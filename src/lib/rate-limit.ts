// Minimal in-memory fixed-window rate limiter for auth endpoints (§41/§71).
// Explicitly NOT sufficient for a multi-instance production deployment —
// state is per-process. Production should replace this with a shared store
// (Redis/Upstash) behind the same checkRateLimit() signature; nothing about
// call sites needs to change.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

// Periodic cleanup so the map doesn't grow unbounded across a long-running
// dev/server process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

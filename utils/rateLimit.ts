/**
 * Minimal sliding-window rate limiter keyed by client IP.
 *
 * State lives in this server process's memory, which suits the single Node
 * server this site runs on (`next start`). Behind several instances each one
 * keeps its own window, so the effective limit multiplies — swap in a shared
 * store (e.g. Redis) if the site is ever scaled out.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function check(key: string, now = Date.now()) {
    const windowStart = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((time) => time > windowStart);

    // Opportunistic cleanup so the map cannot grow without bound
    if (hits.size > 5000) {
      for (const [k, times] of hits) if (!times.some((time) => time > windowStart)) hits.delete(k);
    }

    if (recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
    }

    recent.push(now);
    hits.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

/** First hop in X-Forwarded-For (set by the platform proxy), else X-Real-IP */
export function clientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

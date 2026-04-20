type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function nowMs(): number {
  return Date.now();
}

function cleanupExpired(currentTime: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= currentTime) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const currentTime = nowMs();
  cleanupExpired(currentTime);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= currentTime) {
    buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  if (bucket.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.count),
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
  };
}

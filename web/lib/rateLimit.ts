import { NextRequest } from "next/server";

// محدودکنندهٔ نرخ سادهٔ درون‌حافظه‌ای — کافی برای یک پروسهٔ تک‌نمونه‌ای (systemd، بدون Redis).
// فقط برای مسیرهای نوشتاری Admin (Create/Update/Delete) استفاده می‌شود.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (!realIp || !/^[0-9a-f:.]+$/i.test(realIp)) return "unknown";
  return realIp;
}

/** true یعنی مجاز، false یعنی از سقف رد شده */
export function checkRateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

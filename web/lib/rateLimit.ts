import { NextRequest } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";

// محدودکنندهٔ نرخ سادهٔ درون‌حافظه‌ای — کافی برای یک پروسهٔ تک‌نمونه‌ای (systemd، بدون Redis).
// فقط برای مسیرهای نوشتاری Admin (Create/Update/Delete) استفاده می‌شود.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (!realIp || !/^[0-9a-f:.]+$/i.test(realIp)) return "unknown";
  return realIp;
}

export async function checkPersistentRateLimit(key: string, limit = 30, windowMs = 60_000): Promise<boolean> {
  const result = await sql<{ allowed: boolean }>`
    insert into rate_limit_buckets (bucket_key, count, reset_at)
    values (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    on conflict (bucket_key) do update set
      count = case
        when rate_limit_buckets.reset_at <= now() then 1
        else least(rate_limit_buckets.count + 1, ${limit + 1})
      end,
      reset_at = case
        when rate_limit_buckets.reset_at <= now() then now() + ${windowMs} * interval '1 millisecond'
        else rate_limit_buckets.reset_at
      end
    returning count <= ${limit} as allowed
  `.execute(db);

  return result.rows[0]?.allowed === true;
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

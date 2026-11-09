import { NextRequest } from "next/server";

const PAYMENT_HOSTS = new Set([
  "locationsari.ir",
  "www.locationsari.ir",
  "locationsari.com",
  "www.locationsari.com",
]);

/** دامنهٔ واقعی درخواست را از هدرهای پراکسی برمی‌گرداند؛ پشت Nginx مقدار nextUrl.hostname همیشه localhost است. */
export function requestHostname(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0].trim().toLowerCase();
  const host = (forwarded || req.headers.get("host") || "").split(":")[0].toLowerCase();
  return PAYMENT_HOSTS.has(host) ? host : "locationsari.ir";
}

export function requestOrigin(req: NextRequest): string {
  return `https://${requestHostname(req)}`;
}

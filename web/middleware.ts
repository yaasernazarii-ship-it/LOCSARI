import { NextRequest, NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_HOSTS = new Set([
  "locationsari.ir",
  "www.locationsari.ir",
  "locationsari.com",
  "www.locationsari.com",
  "preview.locationsari.ir",
  "preview.locationsari.com",
]);

export function middleware(req: NextRequest) {
  if (!UNSAFE_METHODS.has(req.method) || !req.cookies.has("ls_session")) return NextResponse.next();

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
  }

  const origin = req.headers.get("origin");
  if (!origin) return NextResponse.next(); // کلاینت‌های بومی/TWA ممکن است Origin نفرستند

  let originHost: string;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
  }

  const requestHost = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (originHost === requestHost || ALLOWED_HOSTS.has(originHost)) return NextResponse.next();

  return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
}

export const config = {
  matcher: "/api/:path*",
};

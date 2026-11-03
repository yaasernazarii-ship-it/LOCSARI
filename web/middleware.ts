import { NextRequest, NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(req: NextRequest) {
  if (!UNSAFE_METHODS.has(req.method) || !req.cookies.has("ls_session")) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (origin) {
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
    }

    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
    const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
    const allowedOrigins = new Set([
      forwardedOrigin,
      "https://locationsari.ir",
      "https://locationsari.com",
    ]);
    if (!allowedOrigins.has(originUrl.origin)) {
      return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
    }
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (!origin && fetchSite === "cross-site") {
    return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

import { NextRequest, NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(req: NextRequest) {
  if (!UNSAFE_METHODS.has(req.method) || !req.cookies.has("ls_session")) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "درخواست از مبدأ نامعتبر است" }, { status: 403 });
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

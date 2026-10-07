import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isNeshanConfigured, neshanStaticMap } from "@/lib/neshan";

// GET /api/geo/static-map?lat=&lng=&w=&h=&zoom= — پروکسی تصویر نقشهٔ استاتیک نشان.
// عمومی است (برای نمایش موقعیت در صفحهٔ «تماس با ما») ولی کلید سرویس نشان هرگز به کلاینت فاش نمی‌شود؛
// خروجی برای کاهش فشار روی سرویس نشان کش می‌شود.
export async function GET(req: NextRequest) {
  if (!checkRateLimit(`geo-static-map:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  if (!isNeshanConfigured()) {
    return NextResponse.json({ error: "سرویس نقشه پیکربندی نشده است" }, { status: 503 });
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "مختصات نامعتبر است" }, { status: 400 });
  }

  const width = Number(req.nextUrl.searchParams.get("w")) || undefined;
  const height = Number(req.nextUrl.searchParams.get("h")) || undefined;
  const zoom = Number(req.nextUrl.searchParams.get("zoom")) || undefined;

  try {
    const { buffer, contentType } = await neshanStaticMap(lat, lng, { width, height, zoom });
    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطا در دریافت نقشه" }, { status: 502 });
  }
}

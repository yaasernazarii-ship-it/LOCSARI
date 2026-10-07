import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { isNeshanConfigured, neshanSearchAddress } from "@/lib/neshan";

// GET /api/geo/search?q=عبارت — جستجوی آدرس/مکان دقیق (نشان) برای انتخاب موقعیت روی نقشه
// در فرم ثبت آگهی و تنظیمات تماس با ما. کلید سرویس نشان فقط همین‌جا (سمت سرور) استفاده می‌شود.
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`geo-search:${auth.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  if (!isNeshanConfigured()) {
    return NextResponse.json({ error: "سرویس نقشه پیکربندی نشده است" }, { status: 503 });
  }

  const term = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (term.length < 2) return NextResponse.json({ items: [] });

  // سایت مختص شهر ساری است؛ اگر کاربر نام شهر را ننویسد، برای دقت بیشتر به آدرس اضافه می‌شود.
  const query = term.includes("ساری") ? term : `ساری، ${term}`;

  try {
    const items = await neshanSearchAddress(query);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطا در جستجوی نقشه" }, { status: 502 });
  }
}

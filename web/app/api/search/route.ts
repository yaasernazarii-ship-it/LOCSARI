import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { validateSearchParams } from "@/lib/search/validate";
import { runSearch } from "@/lib/search/query";

// GET /api/search — API اصلی جستجوی عمومی آگهی‌ها (بخش ۳ پرامپت فاز ۴)
// فقط آگهی‌های status=published و منقضی‌نشده و ملک is_active=true — بدون نیاز به ورود، بدون امکان دورزدن با پارامتر.
export async function GET(req: NextRequest) {
  // Rate limit سخاوتمندانه — جلوگیری از سوءاستفاده بدون مزاحمت برای کاربر عادی (بخش ۳۴ پرامپت)
  if (!checkRateLimit(`search:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const validated = await validateSearchParams(req.nextUrl.searchParams);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const result = await runSearch(validated.filters);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(result.data);
}

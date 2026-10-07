import { NextResponse } from "next/server";
import { getAdvertisementDetail } from "@/lib/search/detail";

// GET /api/advertisements/slug/:slug — جزئیات عمومی آگهی برای صفحهٔ /agahi/[slug] (بخش ۲۶ پرامپت فاز ۴)
// Additive: مسیر id-محور موجود (/api/advertisements/[id]) حذف/جایگزین نمی‌شود.
// فقط آگهی status=published و منقضی‌نشده و ملک is_active=true عمومی است — دقیقاً هم‌راستا با قانون جستجو.
// منطق واکشی در lib/search/detail.ts متمرکز است تا صفحهٔ سرور /agahi/[slug] هم بدون fetch داخلی از همان استفاده کند.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const advertisement = await getAdvertisementDetail(params.slug);
  if (!advertisement) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });
  return NextResponse.json({ advertisement });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/vip/plans — لیست عمومی پلن‌های فعال آگهی VIP (برای صفحهٔ خرید اشتراک)
export async function GET() {
  const plans = await db
    .selectFrom("vip_plans")
    .select(["id", "title", "description", "price", "ad_limit", "discount_percent"])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .execute();

  return NextResponse.json(
    {
      plans: plans.map((p) => ({
        ...p,
        price: Number(p.price),
        discount_percent: Number(p.discount_percent),
        final_price: Math.round(Number(p.price) * (100 - Number(p.discount_percent)) / 100),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

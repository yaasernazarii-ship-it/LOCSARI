import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidPositiveInteger, isValidTomanAmount } from "@/lib/validation";

// GET /api/admin/vip-plans — همهٔ پلن‌ها (فارغ از فعال/غیرفعال بودن)
export async function GET() {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  const plans = await db.selectFrom("vip_plans").selectAll().orderBy("sort_order", "asc").execute();
  return NextResponse.json({
    plans: plans.map((p) => ({ ...p, price: Number(p.price), discount_percent: Number(p.discount_percent) })),
  });
}

// POST /api/admin/vip-plans — ایجاد پلن جدید
export async function POST(req: NextRequest) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!isNonEmptyString(title, 120)) return NextResponse.json({ error: "عنوان پلن نامعتبر است" }, { status: 400 });

  const price = Number(body.price);
  if (!isValidTomanAmount(price)) return NextResponse.json({ error: "قیمت نامعتبر است" }, { status: 400 });

  const adLimit = Number(body.adLimit);
  if (!isValidPositiveInteger(adLimit)) return NextResponse.json({ error: "سقف آگهی VIP نامعتبر است" }, { status: 400 });

  const discountPercent = Number(body.discountPercent ?? 0);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)
    return NextResponse.json({ error: "درصد تخفیف نامعتبر است" }, { status: 400 });

  const plan = await db
    .insertInto("vip_plans")
    .values({
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      price,
      ad_limit: adLimit,
      discount_percent: discountPercent,
      is_active: typeof body.isActive === "boolean" ? body.isActive : true,
      sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "vip_plan", plan.id, { title, price, adLimit, discountPercent });
  return NextResponse.json({ plan: { ...plan, price: Number(plan.price), discount_percent: Number(plan.discount_percent) } }, { status: 201 });
}

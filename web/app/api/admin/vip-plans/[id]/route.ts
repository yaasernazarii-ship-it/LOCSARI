import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidPositiveInteger, isValidTomanAmount, parseId } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const plan = await db.selectFrom("vip_plans").selectAll().where("id", "=", id).executeTakeFirst();
  if (!plan) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });
  return NextResponse.json({ plan: { ...plan, price: Number(plan.price), discount_percent: Number(plan.discount_percent) } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("vip_plans").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title, 120)) return NextResponse.json({ error: "عنوان پلن نامعتبر است" }, { status: 400 });
    update.title = body.title.trim();
  }
  if (body.description !== undefined) {
    update.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!isValidTomanAmount(price)) return NextResponse.json({ error: "قیمت نامعتبر است" }, { status: 400 });
    update.price = price;
  }
  if (body.adLimit !== undefined) {
    const adLimit = Number(body.adLimit);
    if (!isValidPositiveInteger(adLimit)) return NextResponse.json({ error: "سقف آگهی VIP نامعتبر است" }, { status: 400 });
    update.ad_limit = adLimit;
  }
  if (body.discountPercent !== undefined) {
    const discountPercent = Number(body.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)
      return NextResponse.json({ error: "درصد تخفیف نامعتبر است" }, { status: 400 });
    update.discount_percent = discountPercent;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive نامعتبر است" }, { status: 400 });
    update.is_active = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder نامعتبر است" }, { status: 400 });
    update.sort_order = body.sortOrder;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const plan = await db.updateTable("vip_plans").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  await logAdminAction(auth.user.id, "update", "vip_plan", id, { fields: Object.keys(update) });
  return NextResponse.json({ plan: { ...plan, price: Number(plan.price), discount_percent: Number(plan.discount_percent) } });
}

// حذف پلن — فقط اگر هیچ درخواست اشتراکی (حتی تاریخی) به آن ارجاع نداده باشد؛ در غیر این صورت فقط غیرفعال کنید.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("vip_plans").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });

  const used = await db.selectFrom("vip_subscriptions").select("id").where("plan_id", "=", id).executeTakeFirst();
  if (used) return NextResponse.json({ error: "این پلن قبلاً در یک درخواست اشتراک استفاده شده و قابل حذف نیست؛ آن را غیرفعال کنید" }, { status: 409 });

  await db.deleteFrom("vip_plans").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "vip_plan", id, {});
  return NextResponse.json({ success: true });
}

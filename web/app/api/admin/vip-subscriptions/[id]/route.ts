import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

// PATCH /api/admin/vip-subscriptions/:id — تأیید (فعال‌سازی) یا رد یک درخواست خرید اشتراک VIP
// فقط از وضعیت pending قابل انجام است؛ اشتراک تأییدشده تاریخ انقضا ندارد.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const subscription = await db
    .selectFrom("vip_subscriptions")
    .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id")
    .select(["vip_subscriptions.id", "vip_subscriptions.status"])
    .where("vip_subscriptions.id", "=", id)
    .executeTakeFirst();
  if (!subscription) return NextResponse.json({ error: "درخواست اشتراک یافت نشد" }, { status: 404 });
  if (subscription.status !== "pending") {
    return NextResponse.json({ error: "فقط درخواست‌های در انتظار بررسی قابل تأیید/رد هستند" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
  }

  if (action === "reject") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "دلیل رد الزامی است" }, { status: 400 });
    const updated = await db
      .updateTable("vip_subscriptions")
      .set({
        status: "rejected",
        admin_note: reason,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await logAdminAction(auth.user.id, "update", "vip_subscription", id, { action: "reject", reason });
    return NextResponse.json({ subscription: { ...updated, price: Number(updated.price) } });
  }

  const startsAt = new Date();

  const updated = await db
    .updateTable("vip_subscriptions")
    .set({
      status: "active",
      starts_at: startsAt.toISOString(),
      ends_at: null,
      admin_note: typeof body.note === "string" ? body.note.trim() || null : null,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "vip_subscription", id, { action: "approve" });
  return NextResponse.json({ subscription: { ...updated, price: Number(updated.price) } });
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { getActiveVipSubscription } from "@/lib/vip";
import { createZibalPayment } from "@/lib/zibal";

const PAYMENT_HOSTS = new Set(["locationsari.ir", "www.locationsari.ir", "locationsari.com", "www.locationsari.com"]);

function paymentOrigin(req: NextRequest): string {
  return PAYMENT_HOSTS.has(req.nextUrl.hostname) ? `https://${req.nextUrl.hostname}` : "https://locationsari.ir";
}

// GET /api/account/vip-subscriptions — تاریخچهٔ اشتراک‌های VIP کاربر جاری + اشتراک فعال (در صورت وجود)
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const activeSubscription = await getActiveVipSubscription(db, auth.user.id);

  const rows = await db
    .selectFrom("vip_subscriptions")
    .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id")
    .select([
      "vip_subscriptions.id",
      "vip_subscriptions.status",
      "vip_subscriptions.price",
      "vip_subscriptions.ad_limit",
      "vip_subscriptions.agency_id",
      "vip_subscriptions.starts_at",
      "vip_subscriptions.ends_at",
      "vip_subscriptions.admin_note",
      "vip_subscriptions.created_at",
      "vip_plans.title as plan_title",
      "vip_plans.duration_days as plan_duration_days",
    ])
    .where("vip_subscriptions.user_id", "=", auth.user.id)
    .orderBy("vip_subscriptions.created_at", "desc")
    .execute();

  return NextResponse.json({
    subscriptions: rows.map((r) => ({ ...r, price: Number(r.price) })),
    activeSubscriptionId: activeSubscription?.id ?? null,
  });
}

// POST /api/account/vip-subscriptions — ایجاد سفارش پرداخت زیبال برای پلن VIP.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`vip-subscription-request:${auth.user.id}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  if (!checkRateLimit(`vip-subscription-request-ip:${getClientIp(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const agencyMembership = await db
    .selectFrom("agency_memberships")
    .select(["id", "agency_id"])
    .where("user_id", "=", auth.user.id)
    .where("status", "=", "active")
    .executeTakeFirst();
  if (!agencyMembership) {
    return NextResponse.json({ error: "خرید اشتراک VIP فقط برای اعضای فعال آژانس‌ها امکان‌پذیر است" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const planId = parseId(String(body?.planId ?? ""));
  if (!planId) return NextResponse.json({ error: "planId نامعتبر است" }, { status: 400 });

  const plan = await db.selectFrom("vip_plans").selectAll().where("id", "=", planId).executeTakeFirst();
  if (!plan || !plan.is_active) return NextResponse.json({ error: "پلن انتخاب‌شده یافت نشد یا غیرفعال است" }, { status: 400 });

  const subscription = await db.transaction().execute(async (tx) => {
    await sql`select pg_advisory_xact_lock(823003, ${auth.user.id})`.execute(tx);
    const existingPending = await tx
      .selectFrom("vip_subscriptions")
      .select("id")
      .where("user_id", "=", auth.user.id)
      .where("status", "=", "awaiting_payment")
      .executeTakeFirst();
    if (existingPending) {
      const payment = await tx
        .selectFrom("payment_orders")
        .select(["id", "amount_rial"])
        .where("subscription_id", "=", existingPending.id)
        .where("status", "=", "pending")
        .executeTakeFirst();
      if (!payment) return null;
      const renewedPayment = await createZibalPayment(
        Number(payment.amount_rial),
        `${paymentOrigin(req)}/api/payments/zibal/callback`,
        `خرید اشتراک VIP: ${plan.title}`
      );
      await tx
        .updateTable("payment_orders")
        .set({ authority: renewedPayment.authority, updated_at: new Date().toISOString() })
        .where("id", "=", payment.id)
        .execute();
      return { subscription: null, redirectUrl: renewedPayment.redirectUrl };
    }

    const created = await tx
      .insertInto("vip_subscriptions")
      .values({
        user_id: auth.user.id,
        plan_id: plan.id,
        agency_id: agencyMembership.agency_id,
        status: "awaiting_payment",
        price: Math.round(Number(plan.price) * (100 - Number(plan.discount_percent)) / 100),
        ad_limit: plan.ad_limit,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const payment = await createZibalPayment(
      Number(created.price) * 10,
      `${paymentOrigin(req)}/api/payments/zibal/callback`,
      `خرید اشتراک VIP: ${plan.title}`
    );

    await tx
      .insertInto("payment_orders")
      .values({
        subscription_id: created.id,
        user_id: auth.user.id,
        gateway: "zibal",
        authority: payment.authority,
        amount_rial: Number(created.price) * 10,
      })
      .execute();

    return { subscription: created, redirectUrl: payment.redirectUrl };
  });
  if (!subscription) return NextResponse.json({ error: "شما یک سفارش خرید اشتراک VIP در انتظار پرداخت دارید" }, { status: 409 });
  if (!subscription.subscription) return NextResponse.json({ redirectUrl: subscription.redirectUrl }, { status: 200 });

  await logAdminAction(auth.user.id, "create", "vip_subscription", subscription.subscription.id, { planId: plan.id, gateway: "zibal" });
  return NextResponse.json(
    { subscription: { ...subscription.subscription, price: Number(subscription.subscription.price) }, redirectUrl: subscription.redirectUrl },
    { status: 201 }
  );
}

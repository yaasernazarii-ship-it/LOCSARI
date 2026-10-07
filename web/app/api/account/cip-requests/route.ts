import { NextRequest, NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createZibalPayment } from "@/lib/zibal";
import { parseId } from "@/lib/validation";

const PAYMENT_HOSTS = new Set(["locationsari.ir", "www.locationsari.ir", "locationsari.com", "www.locationsari.com"]);

function paymentOrigin(req: NextRequest): string {
  return PAYMENT_HOSTS.has(req.nextUrl.hostname) ? `https://${req.nextUrl.hostname}` : "https://locationsari.ir";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!checkRateLimit(`cip-request:${auth.user.id}`, 5, 10 * 60_000) || !checkRateLimit(`cip-request-ip:${getClientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const planId = parseId(String(body?.planId ?? ""));
  const advertisementId = parseId(String(body?.advertisementId ?? ""));
  if (!planId || !advertisementId) return NextResponse.json({ error: "پلن یا آگهی نامعتبر است" }, { status: 400 });
  const [plan, advertisement] = await Promise.all([
    db.selectFrom("cip_plans").selectAll().where("id", "=", planId).where("is_active", "=", true).executeTakeFirst(),
    db.selectFrom("advertisements").select("id").where("id", "=", advertisementId).where("created_by_user_id", "=", auth.user.id).executeTakeFirst(),
  ]);
  if (!plan || !advertisement) return NextResponse.json({ error: "پلن یا آگهی انتخاب‌شده یافت نشد" }, { status: 404 });
  const result = await db.transaction().execute(async (tx) => {
    await sql`select pg_advisory_xact_lock(823004, ${auth.user.id})`.execute(tx);
    const existing = await tx
      .selectFrom("cip_requests")
      .select("id")
      .where("user_id", "=", auth.user.id)
      .where("status", "=", "awaiting_payment")
      .executeTakeFirst();
    if (existing) {
      const payment = await tx
        .selectFrom("cip_payment_orders")
        .select(["id", "amount_rial"])
        .where("cip_request_id", "=", existing.id)
        .where("status", "=", "awaiting_payment")
        .executeTakeFirst();
      if (!payment) return null;
      const renewedPayment = await createZibalPayment(
        Number(payment.amount_rial),
        `${paymentOrigin(req)}/api/payments/zibal/callback`,
        `سفارش ویدیوی CIP: ${plan.title}`
      );
      await tx
        .updateTable("cip_payment_orders")
        .set({ authority: renewedPayment.authority, updated_at: new Date().toISOString() })
        .where("id", "=", payment.id)
        .execute();
      return { redirectUrl: renewedPayment.redirectUrl };
    }
    const cipRequest = await tx.insertInto("cip_requests").values({ user_id: auth.user.id, advertisement_id: advertisement.id, plan_id: plan.id, price: Number(plan.price) }).returningAll().executeTakeFirstOrThrow();
    const payment = await createZibalPayment(Number(plan.price) * 10, `${paymentOrigin(req)}/api/payments/zibal/callback`, `سفارش ویدیوی CIP: ${plan.title}`);
    await tx.insertInto("cip_payment_orders").values({ cip_request_id: cipRequest.id, user_id: auth.user.id, gateway: "zibal", authority: payment.authority, amount_rial: Number(plan.price) * 10 }).execute();
    return { redirectUrl: payment.redirectUrl };
  });
  if (!result) return NextResponse.json({ error: "یک سفارش CIP در انتظار پرداخت دارید" }, { status: 409 });
  return NextResponse.json(result, { status: 201 });
}

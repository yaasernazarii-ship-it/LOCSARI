import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyZibalPayment } from "@/lib/zibal";

const PAYMENT_HOSTS = new Set(["locationsari.ir", "www.locationsari.ir", "locationsari.com", "www.locationsari.com"]);

function resultUrl(req: NextRequest, status: "success" | "failed", message: string) {
  const origin = PAYMENT_HOSTS.has(req.nextUrl.hostname) ? `https://${req.nextUrl.hostname}` : "https://locationsari.ir";
  return new URL(`/account/vip?payment=${status}&message=${encodeURIComponent(message)}`, origin);
}

export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get("trackId");
  if (!authority || !/^\d+$/.test(authority)) {
    return NextResponse.redirect(resultUrl(req,"failed", "شناسهٔ پرداخت نامعتبر است"));
  }

  const cipOrder = await db
    .selectFrom("cip_payment_orders")
    .select(["id", "status", "amount_rial", "cip_request_id"])
    .where("gateway", "=", "zibal")
    .where("authority", "=", authority)
    .executeTakeFirst();
  if (cipOrder) {
    const origin = PAYMENT_HOSTS.has(req.nextUrl.hostname) ? `https://${req.nextUrl.hostname}` : "https://locationsari.com";
    const cipUrl = (status: "success" | "failed", message: string) => new URL(`/account/cip?payment=${status}&message=${encodeURIComponent(message)}`, origin);
    if (cipOrder.status === "paid") return NextResponse.redirect(cipUrl("success", "پرداخت قبلاً تأیید شده است"));
    try {
      const verification = await verifyZibalPayment(authority, Number(cipOrder.amount_rial), req.nextUrl.hostname);
      if (!verification.success) {
        await db.transaction().execute(async (tx) => {
          await tx.updateTable("cip_payment_orders").set({ status: "failed", error_code: String(verification.result.result), verify_payload: verification.result, updated_at: new Date().toISOString() }).where("id", "=", cipOrder.id).execute();
          await tx.updateTable("cip_requests").set({ status: "cancelled", updated_at: new Date().toISOString() }).where("id", "=", cipOrder.cip_request_id).where("status", "=", "awaiting_payment").execute();
        });
        return NextResponse.redirect(cipUrl("failed", "پرداخت تأیید نشد"));
      }
      await db.transaction().execute(async (tx) => {
        const updated = await tx.updateTable("cip_payment_orders").set({ status: "paid", ref_id: verification.refId, card_pan: verification.cardPan, verify_payload: verification.result, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).where("id", "=", cipOrder.id).where("status", "=", "awaiting_payment").returning("id").executeTakeFirst();
        if (updated) await tx.updateTable("cip_requests").set({ status: "paid", updated_at: new Date().toISOString() }).where("id", "=", cipOrder.cip_request_id).execute();
      });
      return NextResponse.redirect(cipUrl("success", "پرداخت با موفقیت انجام شد؛ تیم ما برای هماهنگی با شما تماس می‌گیرد"));
    } catch {
      return NextResponse.redirect(cipUrl("failed", "خطا در تأیید پرداخت؛ لطفاً با پشتیبانی تماس بگیرید"));
    }
  }

  const order = await db
    .selectFrom("payment_orders")
    .innerJoin("vip_subscriptions", "vip_subscriptions.id", "payment_orders.subscription_id")
    .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id")
    .select([
      "payment_orders.id",
      "payment_orders.status",
      "payment_orders.amount_rial",
      "payment_orders.subscription_id",
    ])
    .where("payment_orders.gateway", "=", "zibal")
    .where("payment_orders.authority", "=", authority)
    .executeTakeFirst();

  if (!order) return NextResponse.redirect(resultUrl(req,"failed", "سفارش پرداخت یافت نشد"));
  if (order.status === "paid") return NextResponse.redirect(resultUrl(req,"success", "پرداخت قبلاً تأیید شده است"));

  try {
    const verification = await verifyZibalPayment(authority, Number(order.amount_rial), req.nextUrl.hostname);
    const callbackPayload = Object.fromEntries(req.nextUrl.searchParams.entries());

    if (!verification.success) {
      await db.transaction().execute(async (tx) => {
        await tx
          .updateTable("payment_orders")
          .set({ status: "failed", error_code: String(verification.result.result), callback_payload: callbackPayload, verify_payload: verification.result, updated_at: new Date().toISOString() })
          .where("id", "=", order.id)
          .execute();
        await tx
          .updateTable("vip_subscriptions")
          .set({ status: "cancelled", updated_at: new Date().toISOString() })
          .where("id", "=", order.subscription_id)
          .where("status", "=", "awaiting_payment")
          .execute();
      });
      return NextResponse.redirect(resultUrl(req,"failed", "پرداخت تأیید نشد"));
    }

    await db.transaction().execute(async (tx) => {
      const updated = await tx
        .updateTable("payment_orders")
        .set({
          status: "paid",
          ref_id: verification.refId,
          card_pan: verification.cardPan,
          callback_payload: callbackPayload,
          verify_payload: verification.result,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", order.id)
        .where("status", "=", "awaiting_payment")
        .returning("id")
        .executeTakeFirst();
      if (!updated) return;

      const startedAt = new Date();
      await tx
        .updateTable("vip_subscriptions")
        .set({
          status: "active",
          starts_at: startedAt.toISOString(),
          ends_at: null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", order.subscription_id)
        .execute();
    });

    return NextResponse.redirect(resultUrl(req,"success", "پرداخت با موفقیت انجام شد و اشتراک فعال گردید"));
  } catch {
    await db.transaction().execute(async (tx) => {
      await tx
        .updateTable("payment_orders")
        .set({ status: "failed", error_code: "verify_error", updated_at: new Date().toISOString() })
        .where("id", "=", order.id)
        .where("status", "=", "awaiting_payment")
        .execute();
      await tx
        .updateTable("vip_subscriptions")
        .set({ status: "cancelled", updated_at: new Date().toISOString() })
        .where("id", "=", order.subscription_id)
        .where("status", "=", "awaiting_payment")
        .execute();
    });
    return NextResponse.redirect(resultUrl(req,"failed", "خطا در تأیید پرداخت؛ لطفاً با پشتیبانی تماس بگیرید"));
  }
}

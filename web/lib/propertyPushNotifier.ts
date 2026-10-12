import webpush from "web-push";
import { db } from "@/lib/db";

type Advertisement = { id: number; slug: string; transaction_type: string; price: string | null };

function configured() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:info@locationsari.ir", publicKey, privateKey);
  return true;
}

export async function notifyPropertyAlertPush(alertId: number, ad: Advertisement) {
  const subscriptions = await db.selectFrom("push_subscriptions").selectAll().where("property_alert_id", "=", alertId).execute();
  if (subscriptions.length === 0) return;
  const ready = configured();
  const url = `https://locationsari.ir/agahi/${ad.slug}`;

  for (const subscription of subscriptions) {
    const existing = await db.selectFrom("push_deliveries").select("id").where("property_alert_id", "=", alertId).where("advertisement_id", "=", ad.id).where("push_subscription_id", "=", subscription.id).executeTakeFirst();
    if (existing) continue;
    if (!ready) {
      await db.insertInto("push_deliveries").values({ property_alert_id: alertId, advertisement_id: ad.id, push_subscription_id: subscription.id, status: "skipped", error_message: "کلیدهای VAPID پیکربندی نشده‌اند" }).execute();
      continue;
    }
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key } }, JSON.stringify({ title: "آگهی منطبق جدید", body: "یک آگهی جدید مطابق نیاز شما ثبت شد.", url }));
      await db.insertInto("push_deliveries").values({ property_alert_id: alertId, advertisement_id: ad.id, push_subscription_id: subscription.id, status: "sent" }).execute();
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await db.deleteFrom("push_subscriptions").where("id", "=", subscription.id).execute();
      await db.insertInto("push_deliveries").values({ property_alert_id: alertId, advertisement_id: ad.id, push_subscription_id: subscription.id, status: "failed", error_message: error instanceof Error ? error.message : "خطای ارسال اعلان" }).execute();
    }
  }
}

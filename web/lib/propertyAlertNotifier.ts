import { db } from "@/lib/db";
import { notifyPropertyAlertPush } from "@/lib/propertyPushNotifier";

export async function notifyPropertyAlerts(advertisementId: number, propertyId: number) {
  const ad = await db.selectFrom("advertisements").innerJoin("properties", "properties.id", "advertisements.property_id").select(["advertisements.id", "advertisements.slug", "advertisements.transaction_type", "advertisements.price", "properties.category_id", "properties.neighborhood_id", "properties.area"]).where("advertisements.id", "=", advertisementId).where("properties.id", "=", propertyId).executeTakeFirst();
  if (!ad) return;
  let alerts = db.selectFrom("property_alerts").selectAll().where("is_active", "=", true);
  const rows = await alerts.execute();
  for (const alert of rows) {
    if (alert.deal_type && alert.deal_type !== ad.transaction_type) continue;
    if (alert.neighborhood_id && alert.neighborhood_id !== ad.neighborhood_id) continue;
    if (alert.max_price !== null && ad.price !== null && Number(ad.price) > Number(alert.max_price)) continue;
    if (alert.min_area !== null && ad.area !== null && Number(ad.area) < Number(alert.min_area)) continue;
    await notifyPropertyAlertPush(alert.id, ad);
    const existing = await db.selectFrom("property_alert_deliveries").select("id").where("property_alert_id", "=", alert.id).where("advertisement_id", "=", advertisementId).executeTakeFirst();
    if (existing) continue;
    const templateId = Number(process.env.SMSIR_PROPERTY_ALERT_TEMPLATE_ID);
    if (!process.env.SMSIR_API_KEY || !templateId) {
      await db.insertInto("property_alert_deliveries").values({ property_alert_id: alert.id, advertisement_id: advertisementId, status: "skipped", error_message: "سرویس یا قالب پیامک اطلاع‌رسانی پیکربندی نشده است" }).execute();
      continue;
    }
    try {
      const link = `https://locationsari.ir/agahi/${ad.slug}`;
      const response = await fetch("https://api.sms.ir/v1/send/verify", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.SMSIR_API_KEY }, body: JSON.stringify({ mobile: alert.phone, templateId, parameters: [{ name: "name", value: alert.recipient_name ?? "کاربر گرامی" }, { name: "link", value: link }] }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await db.insertInto("property_alert_deliveries").values({ property_alert_id: alert.id, advertisement_id: advertisementId, status: "sent" }).execute();
      await db.updateTable("property_alerts").set({ last_notified_advertisement_id: advertisementId, updated_at: new Date().toISOString() }).where("id", "=", alert.id).execute();
    } catch (error) {
      await db.insertInto("property_alert_deliveries").values({ property_alert_id: alert.id, advertisement_id: advertisementId, status: "failed", error_message: error instanceof Error ? error.message : "خطای ارسال" }).execute();
    }
  }
}

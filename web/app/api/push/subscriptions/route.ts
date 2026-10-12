import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

type Body = {
  alertId?: unknown;
  pushToken?: unknown;
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
};

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`push-subscription:${getClientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as Body | null;
  const alertId = typeof body?.alertId === "number" ? body.alertId : 0;
  const pushToken = typeof body?.pushToken === "string" ? body.pushToken : "";
  const endpoint = typeof body?.subscription?.endpoint === "string" ? body.subscription.endpoint : "";
  const p256dh = typeof body?.subscription?.keys?.p256dh === "string" ? body.subscription.keys.p256dh : "";
  const auth = typeof body?.subscription?.keys?.auth === "string" ? body.subscription.keys.auth : "";
  if (!Number.isInteger(alertId) || !pushToken || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "اطلاعات اعلان نامعتبر است" }, { status: 400 });
  }

  const alert = await db.selectFrom("property_alerts").select("id").where("id", "=", alertId).where("push_token", "=", pushToken).executeTakeFirst();
  if (!alert) return NextResponse.json({ error: "درخواست نیازسنجی پیدا نشد" }, { status: 404 });

  await db.insertInto("push_subscriptions").values({ property_alert_id: alert.id, endpoint, p256dh_key: p256dh, auth_key: auth, updated_at: new Date().toISOString() })
    .onConflict((oc) => oc.column("endpoint").doUpdateSet({ property_alert_id: alert.id, p256dh_key: p256dh, auth_key: auth, updated_at: new Date().toISOString() }))
    .execute();
  return NextResponse.json({ subscribed: true });
}

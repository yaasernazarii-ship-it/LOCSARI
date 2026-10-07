import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";

// GET /api/admin/settings/contact — دریافت اطلاعات تماس سایت (تک‌رکورد) برای ویرایش در پنل
export async function GET() {
  const auth = await requirePermission("content.view");
  if (auth.response) return auth.response;

  const contact = await db.selectFrom("site_contact_info").selectAll().where("id", "=", 1).executeTakeFirst();
  return NextResponse.json({ contact: contact ?? null });
}

const TEXT_FIELDS = ["address", "telegram_url", "instagram_url", "eitaa_url", "whatsapp_url"] as const;
const MAX_PHONES = 10;

// PATCH /api/admin/settings/contact — ویرایش اطلاعات تماس سایت (آدرس، شماره تماس‌ها، شبکه‌های اجتماعی)
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && typeof body[field] !== "string") {
      return NextResponse.json({ error: "مقدار فیلدها باید متنی باشد" }, { status: 400 });
    }
    const trimmed = typeof body[field] === "string" ? body[field].trim() : null;
    update[field] = trimmed || null;
  }

  if (body.latitude !== undefined) {
    if (body.latitude !== null && (typeof body.latitude !== "number" || body.latitude < -90 || body.latitude > 90)) {
      return NextResponse.json({ error: "latitude نامعتبر است" }, { status: 400 });
    }
    update.latitude = body.latitude;
  }
  if (body.longitude !== undefined) {
    if (body.longitude !== null && (typeof body.longitude !== "number" || body.longitude < -180 || body.longitude > 180)) {
      return NextResponse.json({ error: "longitude نامعتبر است" }, { status: 400 });
    }
    update.longitude = body.longitude;
  }

  if (body.phones !== undefined) {
    if (!Array.isArray(body.phones) || body.phones.some((p: unknown) => typeof p !== "string")) {
      return NextResponse.json({ error: "فهرست شماره‌ها نامعتبر است" }, { status: 400 });
    }
    const phones = body.phones.map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    if (phones.length > MAX_PHONES) {
      return NextResponse.json({ error: `حداکثر ${MAX_PHONES} شماره تماس مجاز است` }, { status: 400 });
    }
    update.phones = JSON.stringify(phones);
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const contact = await db
    .insertInto("site_contact_info")
    .values({ id: 1, ...update })
    .onConflict((oc) => oc.column("id").doUpdateSet(update))
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "site_contact_info", 1, { fields: Object.keys(update) });
  return NextResponse.json({ contact });
}

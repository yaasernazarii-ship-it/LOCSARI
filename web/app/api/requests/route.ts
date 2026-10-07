import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, isValidRequestType, isValidTimeString } from "@/lib/validation";

// POST /api/requests — ثبت درخواست تماس/بازدید روی یک آگهی منتشرشده (فاز ۵.۱ «Contact & Viewing Request Inbox»)
// همان Entity ساخته‌شده در فاز ۵ (advertisement_inquiries) را با owner_user_id/preferred_time/status کامل‌تر استفاده می‌کند؛
// برخلاف نسخهٔ قبلی، ثبت درخواست فقط برای کاربر واردشده مجاز است (بخش ۵ پرامپت: مهمان به Login هدایت شود).
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`request-create:user:${auth.user.id}`, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  }
  if (!checkRateLimit(`request-create:ip:${getClientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const advertisementId = parseId(String(body.advertisementId ?? ""));
  if (!advertisementId) return NextResponse.json({ error: "advertisementId نامعتبر است" }, { status: 400 });

  if (!isValidRequestType(body.type)) return NextResponse.json({ error: "type نامعتبر است" }, { status: 400 });
  const type = body.type;

  // فقط روی آگهی منتشرشده/فعال/منقضی‌نشده (بخش ۹ پرامپت) قابل ثبت است
  const ad = await db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .select([
      "advertisements.id",
      "advertisements.status",
      "advertisements.expires_at",
      "advertisements.created_by_user_id",
      "properties.is_active",
    ])
    .where("advertisements.id", "=", advertisementId)
    .executeTakeFirst();
  if (!ad || ad.status !== "published" || !ad.is_active || (ad.expires_at && new Date(ad.expires_at) < new Date())) {
    return NextResponse.json({ error: "آگهی یافت نشد یا برای درخواست در دسترس نیست" }, { status: 404 });
  }
  if (ad.created_by_user_id === auth.user.id) {
    return NextResponse.json({ error: "این آگهی متعلق به خود شماست" }, { status: 400 });
  }

  const message = typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1000) : null;

  let preferredDate: string | null = null;
  let preferredTime: string | null = null;
  if (type === "viewing_request") {
    if (typeof body.preferredDate !== "string" || !body.preferredDate) {
      return NextResponse.json({ error: "preferredDate برای درخواست بازدید الزامی است" }, { status: 400 });
    }
    const d = new Date(body.preferredDate);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "preferredDate نامعتبر است" }, { status: 400 });
    preferredDate = body.preferredDate;

    if (body.preferredTime !== undefined && body.preferredTime !== null && body.preferredTime !== "") {
      if (!isValidTimeString(body.preferredTime)) return NextResponse.json({ error: "preferredTime نامعتبر است" }, { status: 400 });
      preferredTime = body.preferredTime;
    }
  }

  // جلوگیری از درخواست‌های تکراری پشت‌سرهم (بخش ۱۰ پرامپت: جلوگیری از Spam)
  const recentDuplicate = await db
    .selectFrom("advertisement_inquiries")
    .select("id")
    .where("advertisement_id", "=", advertisementId)
    .where("user_id", "=", auth.user.id)
    .where("type", "=", type)
    .where("created_at", ">", new Date(Date.now() - 10 * 60_000))
    .executeTakeFirst();
  if (recentDuplicate) {
    return NextResponse.json({ error: "شما به‌تازگی درخواست مشابهی برای این آگهی ثبت کرده‌اید" }, { status: 409 });
  }

  const request = await db
    .insertInto("advertisement_inquiries")
    .values({
      advertisement_id: advertisementId,
      user_id: auth.user.id,
      owner_user_id: ad.created_by_user_id,
      type,
      name: auth.user.name,
      phone: auth.user.phone,
      message,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "advertisement_inquiry", request.id, { advertisementId, type });

  return NextResponse.json({ request }, { status: 201 });
}

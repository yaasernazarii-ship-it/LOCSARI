import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";

// GET /api/account/requests — صندوق واحد درخواست‌های تماس/بازدید (فاز ۵.۱)
// شامل هم درخواست‌هایی که کاربر به‌عنوان مالک آگهی دریافت کرده («received») و هم درخواست‌هایی
// که خودش برای آگهی دیگران ثبت کرده («sent») — طبق بخش ۱۲ پرامپت، یک Inbox واحد، نه دو سیستم جدا.
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const rows = await db
    .selectFrom("advertisement_inquiries")
    .innerJoin("advertisements", "advertisements.id", "advertisement_inquiries.advertisement_id")
    .leftJoin("properties", "properties.id", "advertisements.property_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .select([
      "advertisement_inquiries.id",
      "advertisement_inquiries.advertisement_id",
      "advertisement_inquiries.user_id",
      "advertisement_inquiries.owner_user_id",
      "advertisement_inquiries.type",
      "advertisement_inquiries.name",
      "advertisement_inquiries.phone",
      "advertisement_inquiries.message",
      "advertisement_inquiries.preferred_date",
      "advertisement_inquiries.preferred_time",
      "advertisement_inquiries.status",
      "advertisement_inquiries.created_at",
      "advertisement_inquiries.updated_at",
      "advertisements.title as advertisement_title",
      "advertisements.slug as advertisement_slug",
      "property_media.url as primary_image",
    ])
    .where((eb) => eb.or([eb("advertisement_inquiries.owner_user_id", "=", auth.user.id), eb("advertisement_inquiries.user_id", "=", auth.user.id)]))
    .orderBy("advertisement_inquiries.created_at", "desc")
    .execute();

  const requests = rows.map((r) => ({
    id: r.id,
    advertisementId: r.advertisement_id,
    advertisementTitle: r.advertisement_title,
    advertisementSlug: r.advertisement_slug,
    primaryImage: r.primary_image ?? null,
    type: r.type,
    name: r.name,
    phone: r.phone,
    message: r.message,
    preferredDate: r.preferred_date,
    preferredTime: r.preferred_time,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    role: r.owner_user_id === auth.user.id ? ("received" as const) : ("sent" as const),
  }));

  return NextResponse.json({ requests });
}

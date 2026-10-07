import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, AdvertisementStatus } from "@/lib/validation";
import { canTransition, transitionAdvertisementStatus } from "@/lib/advertisementWorkflow";
import { ALLOWED_IMAGE_MIME_TYPES, MIN_PROPERTY_IMAGES } from "@/lib/storage";

// POST /api/advertisements/:id/submit — ارسال برای بررسی مرکزی (DRAFT/REJECTED/EXPIRED -> PENDING_REVIEW)
// کاربر عادی نباید بتواند آگهی را مستقیم منتشر کند (بخش ۸)؛ فقط تا اینجا پیش می‌رود.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.submit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const ad = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && ad.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  const from = ad.status as AdvertisementStatus;
  if (!canTransition(from, "pending_review")) {
    return NextResponse.json({ error: `تغییر وضعیت از ${from} به pending_review مجاز نیست` }, { status: 400 });
  }

  const property = await db.selectFrom("properties").select(["id", "is_active"]).where("id", "=", ad.property_id).executeTakeFirst();
  if (!property || !property.is_active) return NextResponse.json({ error: "ملک مرتبط با این آگهی غیرفعال است" }, { status: 400 });

  // برای ارسال به بررسی، ملک باید حداقل MIN_PROPERTY_IMAGES عکس (نه ویدیو) داشته باشد
  const imageCount = await db
    .selectFrom("property_media")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("property_id", "=", ad.property_id)
    .where("mime_type", "in", Object.keys(ALLOWED_IMAGE_MIME_TYPES))
    .executeTakeFirstOrThrow();
  if (Number(imageCount.count) < MIN_PROPERTY_IMAGES) {
    return NextResponse.json(
      { error: `برای ارسال به بررسی، ملک باید حداقل ${MIN_PROPERTY_IMAGES} عکس داشته باشد` },
      { status: 400 }
    );
  }

  await transitionAdvertisementStatus(db, { advertisementId: id, from, to: "pending_review", changedBy: auth.user.id });
  await logAdminAction(auth.user.id, "update", "advertisement", id, { action: "submit" });

  const advertisement = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  return NextResponse.json({ advertisement });
}

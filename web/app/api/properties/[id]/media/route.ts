import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { storage, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_MEDIA_PER_PROPERTY } from "@/lib/storage";

// POST /api/properties/:id/media — بارگذاری تصویر ملک (multipart/form-data، فیلد "file") — بخش ۹ تا ۱۱
// آپلود ویدیو حذف شده: ویدیو فقط برای آگهی‌های VIP و به‌صورت لینک آپارات، توسط ادمین در سطح آگهی تنظیم می‌شود.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("media.upload");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`property-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const propertyId = parseId(params.id);
  if (!propertyId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const property = await db
    .selectFrom("properties")
    .select(["id", "created_by_user_id"])
    .where("id", "=", propertyId)
    .where("is_active", "=", true)
    .executeTakeFirst();
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && property.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isUploadedFile =
    !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isUploadedFile) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });

  const isImage = !!ALLOWED_IMAGE_MIME_TYPES[file.type];
  if (!isImage) {
    return NextResponse.json({ error: "نوع فایل مجاز نیست (فقط تصویر: jpeg/png/webp)" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    const limitMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
    return NextResponse.json({ error: `حجم فایل نامعتبر است (حداکثر ${limitMb} مگابایت)` }, { status: 400 });
  }

  const existingCount = await db
    .selectFrom("property_media")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("property_id", "=", propertyId)
    .executeTakeFirstOrThrow();
  if (Number(existingCount.count) >= MAX_MEDIA_PER_PROPERTY) {
    return NextResponse.json({ error: `حداکثر تعداد رسانه (${MAX_MEDIA_PER_PROPERTY}) برای این ملک ثبت شده است` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = ALLOWED_IMAGE_MIME_TYPES[file.type];
  const saved = await storage.save(buffer, { subDir: `properties/${propertyId}`, extension });

  const existingImageCount = existingCount.count;
  const isFirstImage = Number(existingImageCount) === 0;

  const maxSort = await db
    .selectFrom("property_media")
    .select((eb) => eb.fn.max("sort_order").as("maxSort"))
    .where("property_id", "=", propertyId)
    .executeTakeFirst();

  const altText = typeof (formData?.get("altText")) === "string" ? (formData!.get("altText") as string) : null;

  const media = await db
    .insertInto("property_media")
    .values({
      property_id: propertyId,
      storage_key: saved.key,
      url: saved.url,
      alt_text: altText,
      is_primary: isFirstImage,
      file_size: file.size,
      mime_type: file.type,
      sort_order: (maxSort?.maxSort ?? -1) + 1,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "property_media", media.id, { propertyId });
  return NextResponse.json({ media }, { status: 201 });
}

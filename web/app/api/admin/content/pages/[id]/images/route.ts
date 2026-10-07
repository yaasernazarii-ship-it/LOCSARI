import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { storage, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/storage";

// POST /api/admin/content/pages/:id/images — افزودن تصویر به صفحهٔ محتوا (مثلاً اعتبارات و مجوزات صفحهٔ درباره ما)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const pageId = parseId(params.id);
  if (!pageId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const page = await db.selectFrom("site_pages").select("id").where("id", "=", pageId).executeTakeFirst();
  if (!page) return NextResponse.json({ error: "صفحه یافت نشد" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isUploadedFile = !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isUploadedFile) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });

  const extension = ALLOWED_IMAGE_MIME_TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "نوع فایل مجاز نیست (فقط تصویر: jpeg/png/webp)" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    const limitMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
    return NextResponse.json({ error: `حجم فایل نامعتبر است (حداکثر ${limitMb} مگابایت)` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await storage.save(buffer, { subDir: `site-pages/${pageId}`, extension });

  const maxSort = await db
    .selectFrom("site_page_images")
    .select((eb) => eb.fn.max("sort_order").as("maxSort"))
    .where("page_id", "=", pageId)
    .executeTakeFirst();

  const altText = typeof formData?.get("altText") === "string" ? (formData!.get("altText") as string) : null;

  const image = await db
    .insertInto("site_page_images")
    .values({
      page_id: pageId,
      storage_key: saved.key,
      url: saved.url,
      alt_text: altText,
      sort_order: (maxSort?.maxSort ?? -1) + 1,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "site_page_image", image.id, { pageId });
  return NextResponse.json({ image }, { status: 201 });
}

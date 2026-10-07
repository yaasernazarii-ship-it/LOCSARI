import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug } from "@/lib/validation";
import { isValidAparatUrl } from "@/lib/aparat";

// GET /api/admin/content/pages — فهرست تمام صفحات محتوای سایت (منتشرشده و پیش‌نویس)
export async function GET() {
  const auth = await requirePermission("content.view");
  if (auth.response) return auth.response;

  const pages = await db.selectFrom("site_pages").selectAll().orderBy("sort_order", "asc").orderBy("id", "asc").execute();
  return NextResponse.json({ pages });
}

// POST /api/admin/content/pages — ایجاد صفحهٔ محتوای جدید (درباره ما، قوانین، تماس با ما و ...)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("content.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const bodyText = typeof body?.body === "string" ? body.body : "";
  const seoTitle = typeof body?.seoTitle === "string" ? body.seoTitle.trim() : null;
  const seoDescription = typeof body?.seoDescription === "string" ? body.seoDescription.trim() : null;

  if (!isNonEmptyString(title, 200)) return NextResponse.json({ error: "عنوان نامعتبر است" }, { status: 400 });
  if (seoTitle && seoTitle.length > 200) return NextResponse.json({ error: "عنوان سئو نمی‌تواند بیشتر از ۲۰۰ کاراکتر باشد" }, { status: 400 });
  if (seoDescription && seoDescription.length > 320) return NextResponse.json({ error: "توضیحات سئو نمی‌تواند بیشتر از ۳۲۰ کاراکتر باشد" }, { status: 400 });
  if (!isValidSlug(slug)) return NextResponse.json({ error: "Slug نامعتبر است (فقط حروف لاتین، عدد و خط تیره)" }, { status: 400 });
  if (body?.videoUrl !== undefined && body.videoUrl !== null && !isValidAparatUrl(body.videoUrl)) {
    return NextResponse.json({ error: "لینک ویدیو باید یک آدرس معتبر آپارات باشد" }, { status: 400 });
  }

  try {
    const page = await db
      .insertInto("site_pages")
      .values({
        slug,
        title,
        body: bodyText,
        video_url: typeof body?.videoUrl === "string" ? body.videoUrl.trim() : null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        is_published: typeof body?.isPublished === "boolean" ? body.isPublished : false,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        created_by_user_id: auth.user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "site_page", page.id, { slug, title });
    return NextResponse.json({ page }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

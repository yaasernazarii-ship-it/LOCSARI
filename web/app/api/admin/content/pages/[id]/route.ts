import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseId } from "@/lib/validation";
import { isValidAparatUrl } from "@/lib/aparat";

// GET /api/admin/content/pages/:id — دریافت یک صفحه برای ویرایش
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("content.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const page = await db.selectFrom("site_pages").selectAll().where("id", "=", id).executeTakeFirst();
  if (!page) return NextResponse.json({ error: "صفحه یافت نشد" }, { status: 404 });

  const images = await db
    .selectFrom("site_page_images")
    .selectAll()
    .where("page_id", "=", id)
    .orderBy("sort_order", "asc")
    .orderBy("id", "asc")
    .execute();

  return NextResponse.json({ page, images });
}

// PATCH /api/admin/content/pages/:id — ویرایش عنوان/متن/وضعیت انتشار
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("site_pages").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "صفحه یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title, 200)) return NextResponse.json({ error: "عنوان نامعتبر است" }, { status: 400 });
    update.title = body.title.trim();
  }
  if (body.slug !== undefined) {
    if (!isValidSlug(body.slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });
    update.slug = body.slug;
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string") return NextResponse.json({ error: "متن نامعتبر است" }, { status: 400 });
    update.body = body.body;
  }
  if (body.videoUrl !== undefined) {
    if (body.videoUrl !== null && !isValidAparatUrl(body.videoUrl)) {
      return NextResponse.json({ error: "لینک ویدیو باید یک آدرس معتبر آپارات باشد" }, { status: 400 });
    }
    update.video_url = typeof body.videoUrl === "string" ? body.videoUrl.trim() : null;
  }
  if (body.seoTitle !== undefined) {
    if (body.seoTitle !== null && (typeof body.seoTitle !== "string" || body.seoTitle.trim().length > 200)) {
      return NextResponse.json({ error: "عنوان سئو نامعتبر است" }, { status: 400 });
    }
    update.seo_title = typeof body.seoTitle === "string" ? body.seoTitle.trim() || null : null;
  }
  if (body.seoDescription !== undefined) {
    if (body.seoDescription !== null && (typeof body.seoDescription !== "string" || body.seoDescription.trim().length > 320)) {
      return NextResponse.json({ error: "توضیحات سئو نامعتبر است" }, { status: 400 });
    }
    update.seo_description = typeof body.seoDescription === "string" ? body.seoDescription.trim() || null : null;
  }
  if (body.isPublished !== undefined) {
    if (typeof body.isPublished !== "boolean") return NextResponse.json({ error: "isPublished نامعتبر است" }, { status: 400 });
    update.is_published = body.isPublished;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder نامعتبر است" }, { status: 400 });
    update.sort_order = body.sortOrder;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  try {
    const page = await db.updateTable("site_pages").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
    await logAdminAction(auth.user.id, "update", "site_page", id, { fields: Object.keys(update) });
    return NextResponse.json({ page });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/admin/content/pages/:id — حذف کامل صفحه
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("content.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const deleted = await db.deleteFrom("site_pages").where("id", "=", id).returningAll().executeTakeFirst();
  if (!deleted) return NextResponse.json({ error: "صفحه یافت نشد" }, { status: 404 });

  await logAdminAction(auth.user.id, "delete", "site_page", id, { slug: deleted.slug });
  return NextResponse.json({ ok: true });
}

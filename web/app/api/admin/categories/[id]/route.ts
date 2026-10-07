import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseId } from "@/lib/validation";

const MAX_TREE_DEPTH = 10;

/** جلوگیری از تشکیل حلقه در سلسله‌مراتب Category هنگام تغییر parentId */
async function wouldCreateCycle(categoryId: number, newParentId: number): Promise<boolean> {
  if (newParentId === categoryId) return true;
  let current: number | null = newParentId;
  for (let i = 0; i < MAX_TREE_DEPTH && current !== null; i++) {
    const row = await db.selectFrom("categories").select("parent_id").where("id", "=", current).executeTakeFirst();
    if (!row) return false;
    if (row.parent_id === categoryId) return true;
    current = row.parent_id;
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("category.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const category = await db.selectFrom("categories").selectAll().where("id", "=", id).executeTakeFirst();
  if (!category) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });
  return NextResponse.json({ category });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("category.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("categories").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name, 150)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
    update.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (!isValidSlug(body.slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });
    update.slug = body.slug;
  }
  if (body.parentId !== undefined) {
    if (body.parentId === null) {
      update.parent_id = null;
    } else {
      const parentId = Number(body.parentId);
      if (!Number.isInteger(parentId) || parentId <= 0)
        return NextResponse.json({ error: "parentId نامعتبر است" }, { status: 400 });
      const parent = await db.selectFrom("categories").select("id").where("id", "=", parentId).executeTakeFirst();
      if (!parent) return NextResponse.json({ error: "دستهٔ والد یافت نشد" }, { status: 400 });
      if (await wouldCreateCycle(id, parentId))
        return NextResponse.json({ error: "این تغییر باعث ایجاد حلقه در سلسله‌مراتب می‌شود" }, { status: 400 });
      update.parent_id = parentId;
    }
  }
  if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description : null;
  if (body.icon !== undefined) update.icon = typeof body.icon === "string" ? body.icon : null;
  if (body.image !== undefined) update.image = typeof body.image === "string" ? body.image : null;
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder نامعتبر است" }, { status: 400 });
    update.sort_order = body.sortOrder;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive نامعتبر است" }, { status: 400 });
    update.is_active = body.isActive;
  }
  if (body.seoTitle !== undefined) update.seo_title = typeof body.seoTitle === "string" ? body.seoTitle : null;
  if (body.seoDescription !== undefined)
    update.seo_description = typeof body.seoDescription === "string" ? body.seoDescription : null;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  try {
    const category = await db
      .updateTable("categories")
      .set(update)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "update", "category", id, update);
    return NextResponse.json({ category });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "Slug تکراری است" }, { status: 409 });
    }
    throw err;
  }
}

// حذف منطقی (Soft Delete) — طبق بخش ۱۱ پرامپت
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("category.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const category = await db
    .updateTable("categories")
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (!category) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });

  await logAdminAction(auth.user.id, "delete", "category", id);
  return NextResponse.json({ category });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseOptionalId } from "@/lib/validation";

// GET /api/admin/categories?parentId=X (اختیاری) — همهٔ دسته‌بندی‌ها فارغ از وضعیت فعال/غیرفعال
export async function GET(req: NextRequest) {
  const auth = await requirePermission("category.view");
  if (auth.response) return auth.response;

  const parentId = parseOptionalId(req.nextUrl.searchParams.get("parentId"));
  if (parentId === null) return NextResponse.json({ error: "پارامتر parentId نامعتبر است" }, { status: 400 });

  let query = db.selectFrom("categories").selectAll().orderBy("sort_order", "asc");
  if (parentId !== undefined) query = query.where("parent_id", "=", parentId);

  const categories = await query.execute();
  return NextResponse.json({ categories });
}

// POST /api/admin/categories — ایجاد دسته‌بندی جدید
export async function POST(req: NextRequest) {
  const auth = await requirePermission("category.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const parentId = body?.parentId != null ? Number(body.parentId) : null;

  if (!isNonEmptyString(name, 150)) return NextResponse.json({ error: "نام دسته‌بندی نامعتبر است" }, { status: 400 });
  if (!isValidSlug(slug))
    return NextResponse.json(
      { error: "Slug نامعتبر است (فقط حروف/اعداد لاتین کوچک و خط تیره مجاز است)" },
      { status: 400 }
    );
  if (parentId !== null) {
    if (!Number.isInteger(parentId) || parentId <= 0)
      return NextResponse.json({ error: "parentId نامعتبر است" }, { status: 400 });
    const parent = await db.selectFrom("categories").select("id").where("id", "=", parentId).executeTakeFirst();
    if (!parent) return NextResponse.json({ error: "دستهٔ والد یافت نشد" }, { status: 400 });
  }

  try {
    const category = await db
      .insertInto("categories")
      .values({
        name,
        slug,
        parent_id: parentId,
        description: typeof body?.description === "string" ? body.description : null,
        icon: typeof body?.icon === "string" ? body.icon : null,
        image: typeof body?.image === "string" ? body.image : null,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
        seo_title: typeof body?.seoTitle === "string" ? body.seoTitle : null,
        seo_description: typeof body?.seoDescription === "string" ? body.seoDescription : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "category", category.id, { name, slug });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "Slug تکراری است" }, { status: 409 });
    }
    throw err;
  }
}

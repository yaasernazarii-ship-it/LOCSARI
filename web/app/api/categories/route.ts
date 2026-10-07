import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOptionalId } from "@/lib/validation";

const PUBLIC_COLUMNS = [
  "id",
  "parent_id",
  "name",
  "slug",
  "description",
  "icon",
  "image",
  "sort_order",
  "seo_title",
  "seo_description",
] as const;

// GET /api/categories            -> فقط دسته‌بندی‌های سطح اول (ریشه)
// GET /api/categories?parentId=X -> زیرمجموعه‌های دستهٔ X
// GET /api/categories?all=1      -> همهٔ دسته‌بندی‌های فعال (Flat؛ برای ساخت درخت در کلاینت)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const all = searchParams.get("all") === "1";

  let query = db.selectFrom("categories").select(PUBLIC_COLUMNS).where("is_active", "=", true).orderBy("sort_order", "asc");

  if (!all) {
    const parentIdRaw = searchParams.get("parentId");
    const parentId = parseOptionalId(parentIdRaw);
    if (parentId === null) {
      return NextResponse.json({ error: "پارامتر parentId نامعتبر است" }, { status: 400 });
    }
    query = parentId === undefined ? query.where("parent_id", "is", null) : query.where("parent_id", "=", parentId);
  }

  const categories = await query.execute();
  return NextResponse.json({ categories });
}

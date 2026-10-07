import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";
import { parseOptionalId } from "@/lib/validation";

// GET /api/search/filters — فراداده‌ی عمومی فیلترها برای ساخت فرم جستجو (بخش ۳۶ پرامپت فاز ۴)
// فقط موجودیت‌های فعال؛ داده‌ی کم‌تغییر است پس کش می‌شود (بخش ۳۵). هرگز Search Result اینجا کش نمی‌شود.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const categoryId = parseOptionalId(searchParams.get("categoryId"));
  if (categoryId === null) {
    return NextResponse.json({ error: "پارامتر فیلتر نامعتبر است" }, { status: 400 });
  }

  const categories = await cached("filters:categories", 5 * 60 * 1000, () =>
    db
      .selectFrom("categories")
      .select(["id", "parent_id", "name", "slug"])
      .where("is_active", "=", true)
      .orderBy("sort_order", "asc")
      .execute()
  );

  const neighborhoods = await cached("filters:locations", 5 * 60 * 1000, () =>
    db
      .selectFrom("neighborhoods")
      .select(["id", "name", "slug"])
      .where("is_active", "=", true)
      .orderBy("sort_order", "asc")
      .execute()
  );

  // فیلدهای اختصاصی دسته‌بندی — فقط وقتی categoryId مشخص شده (بخش ۳۹: Filter Dependency)
  let fields: unknown[] = [];
  if (categoryId !== undefined) {
    fields = await cached(`filters:fields:${categoryId}`, 5 * 60 * 1000, async () => {
      const categoryFields = await db
        .selectFrom("category_fields")
        .select(["id", "key", "label_fa", "field_type", "sort_order"])
        .where("category_id", "=", categoryId)
        .where("is_active", "=", true)
        .orderBy("sort_order", "asc")
        .execute();
      const fieldIds = categoryFields.map((f) => f.id);
      const options = fieldIds.length
        ? await db
            .selectFrom("category_field_options")
            .select(["id", "field_id", "value", "label_fa", "sort_order"])
            .where("field_id", "in", fieldIds)
            .where("is_active", "=", true)
            .orderBy("sort_order", "asc")
            .execute()
        : [];
      return categoryFields.map((f) => ({
        ...f,
        options: options.filter((o) => o.field_id === f.id).map(({ field_id: _fieldId, ...rest }) => rest),
      }));
    });
  }

  return NextResponse.json({
    categories,
    neighborhoods,
    fields,
  });
}

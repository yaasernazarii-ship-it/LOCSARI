import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const categoryId = parseId(params.id);
  if (!categoryId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const category = await db
    .selectFrom("categories")
    .select("id")
    .where("id", "=", categoryId)
    .where("is_active", "=", true)
    .executeTakeFirst();
  if (!category) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });

  const fields = await db
    .selectFrom("category_fields")
    .select(["id", "key", "label_fa", "field_type", "is_required", "sort_order"])
    .where("category_id", "=", categoryId)
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .execute();

  const fieldIds = fields.map((f) => f.id);
  const options = fieldIds.length
    ? await db
        .selectFrom("category_field_options")
        .select(["id", "field_id", "value", "label_fa", "sort_order"])
        .where("field_id", "in", fieldIds)
        .where("is_active", "=", true)
        .orderBy("sort_order", "asc")
        .execute()
    : [];

  const result = fields.map((f) => ({
    ...f,
    options: options.filter((o) => o.field_id === f.id).map(({ field_id: _fieldId, ...rest }) => rest),
  }));

  return NextResponse.json({ fields: result });
}

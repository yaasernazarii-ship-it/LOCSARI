import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const category = await db
    .selectFrom("categories")
    .select([
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
    ])
    .where("id", "=", id)
    .where("is_active", "=", true)
    .executeTakeFirst();

  if (!category) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });
  return NextResponse.json({ category });
}

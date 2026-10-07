import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidFieldKey, isValidFieldType, parseId } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("category.field.view");
  if (auth.response) return auth.response;

  const categoryId = parseId(params.id);
  if (!categoryId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const category = await db.selectFrom("categories").select("id").where("id", "=", categoryId).executeTakeFirst();
  if (!category) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });

  const fields = await db
    .selectFrom("category_fields")
    .selectAll()
    .where("category_id", "=", categoryId)
    .orderBy("sort_order", "asc")
    .execute();

  return NextResponse.json({ fields });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("category.field.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const categoryId = parseId(params.id);
  if (!categoryId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const category = await db.selectFrom("categories").select("id").where("id", "=", categoryId).executeTakeFirst();
  if (!category) return NextResponse.json({ error: "دسته‌بندی یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const labelFa = typeof body?.labelFa === "string" ? body.labelFa.trim() : "";
  const fieldType = body?.fieldType;

  if (!isValidFieldKey(key))
    return NextResponse.json({ error: "key نامعتبر است (فقط حروف لاتین کوچک، عدد و آندرلاین)" }, { status: 400 });
  if (!isNonEmptyString(labelFa, 150)) return NextResponse.json({ error: "labelFa نامعتبر است" }, { status: 400 });
  if (!isValidFieldType(fieldType)) return NextResponse.json({ error: "fieldType نامعتبر است" }, { status: 400 });

  try {
    const field = await db
      .insertInto("category_fields")
      .values({
        category_id: categoryId,
        key,
        label_fa: labelFa,
        field_type: fieldType,
        is_required: typeof body?.isRequired === "boolean" ? body.isRequired : false,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "category_field", field.id, { categoryId, key });
    return NextResponse.json({ field }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این key در این دسته‌بندی قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, parseId } from "@/lib/validation";

async function fieldBelongsToCategory(categoryId: number, fieldId: number) {
  return db.selectFrom("category_fields").select("id").where("id", "=", fieldId).where("category_id", "=", categoryId).executeTakeFirst();
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const auth = await requirePermission("category.field.view");
  if (auth.response) return auth.response;

  const categoryId = parseId(params.id);
  const fieldId = parseId(params.fieldId);
  if (!categoryId || !fieldId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  if (!(await fieldBelongsToCategory(categoryId, fieldId)))
    return NextResponse.json({ error: "فیلد یافت نشد" }, { status: 404 });

  const options = await db
    .selectFrom("category_field_options")
    .selectAll()
    .where("field_id", "=", fieldId)
    .orderBy("sort_order", "asc")
    .execute();

  return NextResponse.json({ options });
}

export async function POST(req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const auth = await requirePermission("category.field.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const categoryId = parseId(params.id);
  const fieldId = parseId(params.fieldId);
  if (!categoryId || !fieldId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  if (!(await fieldBelongsToCategory(categoryId, fieldId)))
    return NextResponse.json({ error: "فیلد یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const value = typeof body?.value === "string" ? body.value.trim() : "";
  const labelFa = typeof body?.labelFa === "string" ? body.labelFa.trim() : "";

  if (!isNonEmptyString(value, 80)) return NextResponse.json({ error: "value نامعتبر است" }, { status: 400 });
  if (!isNonEmptyString(labelFa, 150)) return NextResponse.json({ error: "labelFa نامعتبر است" }, { status: 400 });

  try {
    const option = await db
      .insertInto("category_field_options")
      .values({
        field_id: fieldId,
        value,
        label_fa: labelFa,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "category_field_option", option.id, { fieldId, value });
    return NextResponse.json({ option }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این value برای این فیلد قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

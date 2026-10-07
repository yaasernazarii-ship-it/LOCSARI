import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, parseId } from "@/lib/validation";

async function loadOption(fieldId: number, optionId: number) {
  return db
    .selectFrom("category_field_options")
    .selectAll()
    .where("id", "=", optionId)
    .where("field_id", "=", fieldId)
    .executeTakeFirst();
}

async function fieldBelongsToCategory(categoryId: number, fieldId: number) {
  return db.selectFrom("category_fields").select("id").where("id", "=", fieldId).where("category_id", "=", categoryId).executeTakeFirst();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string; optionId: string } }
) {
  const auth = await requirePermission("category.field.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const categoryId = parseId(params.id);
  const fieldId = parseId(params.fieldId);
  const optionId = parseId(params.optionId);
  if (!categoryId || !fieldId || !optionId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  if (!(await fieldBelongsToCategory(categoryId, fieldId)) || !(await loadOption(fieldId, optionId)))
    return NextResponse.json({ error: "گزینه یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.labelFa !== undefined) {
    if (!isNonEmptyString(body.labelFa, 150)) return NextResponse.json({ error: "labelFa نامعتبر است" }, { status: 400 });
    update.label_fa = body.labelFa.trim();
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder نامعتبر است" }, { status: 400 });
    update.sort_order = body.sortOrder;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive نامعتبر است" }, { status: 400 });
    update.is_active = body.isActive;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });

  const option = await db.updateTable("category_field_options").set(update).where("id", "=", optionId).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "category_field_option", optionId, update);
  return NextResponse.json({ option });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string; optionId: string } }
) {
  const auth = await requirePermission("category.field.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const categoryId = parseId(params.id);
  const fieldId = parseId(params.fieldId);
  const optionId = parseId(params.optionId);
  if (!categoryId || !fieldId || !optionId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  if (!(await fieldBelongsToCategory(categoryId, fieldId)) || !(await loadOption(fieldId, optionId)))
    return NextResponse.json({ error: "گزینه یافت نشد" }, { status: 404 });

  await db.deleteFrom("category_field_options").where("id", "=", optionId).execute();
  await logAdminAction(auth.user.id, "delete", "category_field_option", optionId, { fieldId });
  return NextResponse.json({ ok: true });
}

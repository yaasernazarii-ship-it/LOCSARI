import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidFieldType, parseId } from "@/lib/validation";

async function loadFieldInCategory(categoryId: number, fieldId: number) {
  return db.selectFrom("category_fields").selectAll().where("id", "=", fieldId).where("category_id", "=", categoryId).executeTakeFirst();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const auth = await requirePermission("category.field.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const categoryId = parseId(params.id);
  const fieldId = parseId(params.fieldId);
  if (!categoryId || !fieldId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  // IDOR Protection: فیلد باید واقعاً متعلق به همین دسته‌بندی در URL باشد
  const existing = await loadFieldInCategory(categoryId, fieldId);
  if (!existing) return NextResponse.json({ error: "فیلد یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.labelFa !== undefined) {
    if (!isNonEmptyString(body.labelFa, 150)) return NextResponse.json({ error: "labelFa نامعتبر است" }, { status: 400 });
    update.label_fa = body.labelFa.trim();
  }
  if (body.fieldType !== undefined) {
    if (!isValidFieldType(body.fieldType)) return NextResponse.json({ error: "fieldType نامعتبر است" }, { status: 400 });
    update.field_type = body.fieldType;
  }
  if (body.isRequired !== undefined) {
    if (typeof body.isRequired !== "boolean") return NextResponse.json({ error: "isRequired نامعتبر است" }, { status: 400 });
    update.is_required = body.isRequired;
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
  update.updated_at = new Date().toISOString();

  const field = await db.updateTable("category_fields").set(update).where("id", "=", fieldId).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "category_field", fieldId, update);
  return NextResponse.json({ field });
}

// حذف واقعی فیلد (غیرفعال‌سازی از طریق PATCH با isActive=false انجام می‌شود)
export async function DELETE(req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const auth = await requirePermission("category.field.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const categoryId = parseId(params.id);
  const fieldId = parseId(params.fieldId);
  if (!categoryId || !fieldId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await loadFieldInCategory(categoryId, fieldId);
  if (!existing) return NextResponse.json({ error: "فیلد یافت نشد" }, { status: 404 });

  await db.deleteFrom("category_fields").where("id", "=", fieldId).execute();
  await logAdminAction(auth.user.id, "delete", "category_field", fieldId, { categoryId });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidTomanAmount, parseId } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const plan = await db.selectFrom("cip_plans").selectAll().where("id", "=", id).executeTakeFirst();
  if (!plan) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });
  return NextResponse.json({ plan: { ...plan, price: Number(plan.price) } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const existing = await db.selectFrom("cip_plans").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title, 160)) return NextResponse.json({ error: "عنوان پلن نامعتبر است" }, { status: 400 });
    update.title = body.title.trim();
  }
  if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description.trim() : "";
  if (body.features !== undefined) update.features = typeof body.features === "string" ? body.features.trim() : "";
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!isValidTomanAmount(price) || price <= 0) return NextResponse.json({ error: "قیمت باید عددی بزرگ‌تر از صفر باشد" }, { status: 400 });
    update.price = price;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive نامعتبر است" }, { status: 400 });
    update.is_active = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder نامعتبر است" }, { status: 400 });
    update.sort_order = body.sortOrder;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const plan = await db.updateTable("cip_plans").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  await logAdminAction(auth.user.id, "update", "cip_plan", id, { fields: Object.keys(update) });
  return NextResponse.json({ plan: { ...plan, price: Number(plan.price) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const existing = await db.selectFrom("cip_plans").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });
  const used = await db.selectFrom("cip_requests").select("id").where("plan_id", "=", id).executeTakeFirst();
  if (used) return NextResponse.json({ error: "این پلن در یک درخواست CIP استفاده شده و قابل حذف نیست؛ آن را غیرفعال کنید" }, { status: 409 });
  await db.deleteFrom("cip_plans").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "cip_plan", id, {});
  return NextResponse.json({ success: true });
}

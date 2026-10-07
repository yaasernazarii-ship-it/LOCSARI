import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseId } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("location.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("market_zones").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "منطقهٔ عرفی یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name, 100)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
    update.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (!isValidSlug(body.slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });
    update.slug = body.slug;
  }
  if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description : null;
  if (body.cityId !== undefined) {
    const cityId = Number(body.cityId);
    if (!Number.isInteger(cityId) || cityId <= 0) return NextResponse.json({ error: "cityId نامعتبر است" }, { status: 400 });
    const city = await db.selectFrom("cities").select("id").where("id", "=", cityId).executeTakeFirst();
    if (!city) return NextResponse.json({ error: "شهر یافت نشد" }, { status: 400 });
    update.city_id = cityId;
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

  try {
    const marketZone = await db.updateTable("market_zones").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
    await logAdminAction(auth.user.id, "update", "market_zone", id, update);
    return NextResponse.json({ marketZone });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug در این شهر قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("location.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const marketZone = await db
    .updateTable("market_zones")
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (!marketZone) return NextResponse.json({ error: "منطقهٔ عرفی یافت نشد" }, { status: 404 });

  await logAdminAction(auth.user.id, "delete", "market_zone", id);
  return NextResponse.json({ marketZone });
}

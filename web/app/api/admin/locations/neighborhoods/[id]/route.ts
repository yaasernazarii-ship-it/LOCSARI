import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseId } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("neighborhood.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("neighborhoods").selectAll().where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "محله یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  const effectiveCityId = body.cityId !== undefined ? Number(body.cityId) : existing.city_id;

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
    if (!Number.isInteger(effectiveCityId) || effectiveCityId <= 0)
      return NextResponse.json({ error: "cityId نامعتبر است" }, { status: 400 });
    const city = await db.selectFrom("cities").select("id").where("id", "=", effectiveCityId).executeTakeFirst();
    if (!city) return NextResponse.json({ error: "شهر یافت نشد" }, { status: 400 });
    update.city_id = effectiveCityId;
  }
  if (body.districtId !== undefined) {
    if (body.districtId === null) {
      update.district_id = null;
    } else {
      const districtId = Number(body.districtId);
      if (!Number.isInteger(districtId) || districtId <= 0)
        return NextResponse.json({ error: "districtId نامعتبر است" }, { status: 400 });
      const district = await db
        .selectFrom("districts")
        .select("id")
        .where("id", "=", districtId)
        .where("city_id", "=", effectiveCityId)
        .executeTakeFirst();
      if (!district) return NextResponse.json({ error: "منطقهٔ رسمی در این شهر یافت نشد" }, { status: 400 });
      update.district_id = districtId;
    }
  }
  if (body.marketZoneId !== undefined) {
    if (body.marketZoneId === null) {
      update.market_zone_id = null;
    } else {
      const marketZoneId = Number(body.marketZoneId);
      if (!Number.isInteger(marketZoneId) || marketZoneId <= 0)
        return NextResponse.json({ error: "marketZoneId نامعتبر است" }, { status: 400 });
      const marketZone = await db
        .selectFrom("market_zones")
        .select("id")
        .where("id", "=", marketZoneId)
        .where("city_id", "=", effectiveCityId)
        .executeTakeFirst();
      if (!marketZone) return NextResponse.json({ error: "منطقهٔ عرفی در این شهر یافت نشد" }, { status: 400 });
      update.market_zone_id = marketZoneId;
    }
  }
  if (body.latitude !== undefined) {
    const latitude = body.latitude === null ? null : Number(body.latitude);
    if (latitude !== null && !Number.isFinite(latitude)) return NextResponse.json({ error: "latitude نامعتبر است" }, { status: 400 });
    update.latitude = latitude;
  }
  if (body.longitude !== undefined) {
    const longitude = body.longitude === null ? null : Number(body.longitude);
    if (longitude !== null && !Number.isFinite(longitude)) return NextResponse.json({ error: "longitude نامعتبر است" }, { status: 400 });
    update.longitude = longitude;
  }
  if (body.seoTitle !== undefined) update.seo_title = typeof body.seoTitle === "string" ? body.seoTitle : null;
  if (body.seoDescription !== undefined)
    update.seo_description = typeof body.seoDescription === "string" ? body.seoDescription : null;
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
    const neighborhood = await db
      .updateTable("neighborhoods")
      .set(update)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await logAdminAction(auth.user.id, "update", "neighborhood", id, update);
    return NextResponse.json({ neighborhood });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug در این شهر قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("neighborhood.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const neighborhood = await db
    .updateTable("neighborhoods")
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (!neighborhood) return NextResponse.json({ error: "محله یافت نشد" }, { status: 404 });

  await logAdminAction(auth.user.id, "delete", "neighborhood", id);
  return NextResponse.json({ neighborhood });
}

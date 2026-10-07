import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { validatePropertyInput } from "@/lib/propertyInput";
import { validateAndSaveAttributes, getPropertyAttributes, AttributeInput } from "@/lib/propertyAttributes";
import { computeDuplicateFingerprint } from "@/lib/duplicateDetection";

async function hasActivePublishedAd(propertyId: number): Promise<boolean> {
  const ad = await db
    .selectFrom("advertisements")
    .select("id")
    .where("property_id", "=", propertyId)
    .where("status", "=", "published")
    .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())]))
    .executeTakeFirst();
  return Boolean(ad);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const property = await db.selectFrom("properties").selectAll().where("id", "=", id).where("is_active", "=", true).executeTakeFirst();
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const auth = await requireAuth();
  const isOwner = !auth.response && auth.user.id === property.created_by_user_id;
  const reviewer = !auth.response && (await isPropertyReviewer(auth.user.id));

  if (!isOwner && !reviewer) {
    const visible = await hasActivePublishedAd(id);
    if (!visible) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });
  }

  const attributes = await getPropertyAttributes(id);
  const media = await db.selectFrom("property_media").selectAll().where("property_id", "=", id).orderBy("sort_order", "asc").execute();

  return NextResponse.json({ property, attributes, media });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("property.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`property-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("properties").selectAll().where("id", "=", id).where("is_active", "=", true).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && existing.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const validated = await validatePropertyInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const update: Record<string, unknown> = {};
  const map: Record<string, string> = {
    categoryId: "category_id",
    subcategoryId: "subcategory_id",
    cityId: "city_id",
    districtId: "district_id",
    marketZoneId: "market_zone_id",
    neighborhoodId: "neighborhood_id",
    title: "title",
    description: "description",
    area: "area",
    builtArea: "built_area",
    landArea: "land_area",
    bedrooms: "bedrooms",
    builtYear: "built_year",
    floor: "floor",
    totalFloors: "total_floors",
    totalUnits: "total_units",
    latitude: "latitude",
    longitude: "longitude",
    locationPrecision: "location_precision",
  };
  for (const [key, column] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      update[column] = (data as Record<string, unknown>)[key];
    }
  }

  const attributesProvided = Array.isArray((body as Record<string, unknown>).attributes);
  const rawAttributes = attributesProvided ? ((body as Record<string, unknown>).attributes as unknown[]) : [];
  const attributes: AttributeInput[] = [];
  for (const a of rawAttributes) {
    if (!a || typeof a !== "object" || !("fieldId" in a) || !("value" in a))
      return NextResponse.json({ error: "ساختار attributes نامعتبر است" }, { status: 400 });
    attributes.push({ fieldId: Number((a as { fieldId: unknown }).fieldId), value: (a as { value: unknown }).value });
  }

  // اگر یکی از فیلدهای مؤثر بر Fingerprint تغییر کند، دوباره محاسبه می‌شود
  const needsFingerprintRecalc = ["categoryId", "neighborhoodId", "area", "bedrooms", "builtYear"].some((k) =>
    Object.prototype.hasOwnProperty.call(data, k)
  );
  if (needsFingerprintRecalc) {
    update.duplicate_fingerprint = computeDuplicateFingerprint({
      categoryId: (data.categoryId as number | undefined) ?? existing.category_id,
      neighborhoodId: Object.prototype.hasOwnProperty.call(data, "neighborhoodId")
        ? (data.neighborhoodId as number | null)
        : existing.neighborhood_id,
      area: Object.prototype.hasOwnProperty.call(data, "area") ? (data.area as number | null) : existing.area ? Number(existing.area) : null,
      bedrooms: Object.prototype.hasOwnProperty.call(data, "bedrooms") ? (data.bedrooms as number | null) : existing.bedrooms,
      builtYear: Object.prototype.hasOwnProperty.call(data, "builtYear") ? (data.builtYear as number | null) : existing.built_year,
    });
  }

  if (Object.keys(update).length === 0 && !attributesProvided) {
    return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();
  const effectiveCategoryId = (data.categoryId as number | undefined) ?? existing.category_id;

  const property = await db.transaction().execute(async (trx) => {
    let row = existing;
    if (Object.keys(update).length > 0) {
      row = await trx.updateTable("properties").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
    }
    if (attributesProvided) {
      const attrResult = await validateAndSaveAttributes(trx, id, effectiveCategoryId, attributes);
      if (!attrResult.ok) throw new Error(attrResult.error);
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "property", id, { fields: Object.keys(update) });
  const resolvedAttributes = await getPropertyAttributes(id);
  return NextResponse.json({ property, attributes: resolvedAttributes });
}

// حذف منطقی (Soft Delete) — تا زمانی که آگهی منتشرشده/در حال بررسی دارد قابل حذف نیست
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("property.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`property-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const existing = await db.selectFrom("properties").select(["id", "created_by_user_id"]).where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && existing.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  const blockingAd = await db
    .selectFrom("advertisements")
    .select("id")
    .where("property_id", "=", id)
    .where("status", "in", ["published", "pending_review"])
    .executeTakeFirst();
  if (blockingAd) {
    return NextResponse.json({ error: "این ملک آگهی فعال یا در حال بررسی دارد؛ ابتدا آگهی را آرشیو/رد کنید" }, { status: 409 });
  }

  const property = await db
    .updateTable("properties")
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  await logAdminAction(auth.user.id, "delete", "property", id);
  return NextResponse.json({ property });
}

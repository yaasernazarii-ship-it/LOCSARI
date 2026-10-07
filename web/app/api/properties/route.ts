import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validatePropertyInput } from "@/lib/propertyInput";
import { validateAndSaveAttributes, getPropertyAttributes, AttributeInput } from "@/lib/propertyAttributes";
import { computeDuplicateFingerprint } from "@/lib/duplicateDetection";

// GET /api/properties            -> ملک‌های خود کاربر + ملک‌هایی که حداقل یک آگهی منتشرشدهٔ فعال دارند
// GET /api/properties?reviewer=1 -> (فقط برای بازبین مرکزی) همهٔ ملک‌ها فارغ از مالکیت
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const reviewer = await isPropertyReviewer(auth.user.id);

  let query = db.selectFrom("properties").selectAll().where("is_active", "=", true).orderBy("created_at", "desc");

  if (!reviewer) {
    const publishedPropertyIds = await db
      .selectFrom("advertisements")
      .select("property_id")
      .distinct()
      .where("status", "=", "published")
      .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())]))
      .execute();
    const ids = publishedPropertyIds.map((r) => r.property_id);

    query = query.where((eb) => {
      const conditions = [eb("created_by_user_id", "=", auth.user.id)];
      if (ids.length > 0) conditions.push(eb("id", "in", ids));
      return eb.or(conditions);
    });
  }

  const properties = await query.execute();
  return NextResponse.json({ properties });
}

// POST /api/properties — ثبت ملک جدید (بخش ۳ پرامپت) + فیلدهای پویا (بخش ۴)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("property.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`property-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const validated = await validatePropertyInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const rawAttributes = Array.isArray((body as Record<string, unknown>).attributes)
    ? ((body as Record<string, unknown>).attributes as unknown[])
    : [];
  const attributes: AttributeInput[] = [];
  for (const a of rawAttributes) {
    if (!a || typeof a !== "object" || !("fieldId" in a) || !("value" in a))
      return NextResponse.json({ error: "ساختار attributes نامعتبر است" }, { status: 400 });
    attributes.push({ fieldId: Number((a as { fieldId: unknown }).fieldId), value: (a as { value: unknown }).value });
  }

  const fingerprint = computeDuplicateFingerprint({
    categoryId: data.categoryId!,
    neighborhoodId: data.neighborhoodId ?? null,
    area: data.area ?? null,
    bedrooms: data.bedrooms ?? null,
    builtYear: data.builtYear ?? null,
  });

  try {
    const result = await db.transaction().execute(async (trx) => {
      const property = await trx
        .insertInto("properties")
        .values({
          category_id: data.categoryId!,
          subcategory_id: data.subcategoryId ?? null,
          city_id: data.cityId!,
          district_id: data.districtId ?? null,
          market_zone_id: data.marketZoneId ?? null,
          neighborhood_id: data.neighborhoodId ?? null,
          title: data.title!,
          description: data.description ?? null,
          area: data.area ?? null,
          built_area: data.builtArea ?? null,
          land_area: data.landArea ?? null,
          bedrooms: data.bedrooms ?? null,
          built_year: data.builtYear ?? null,
          floor: data.floor ?? null,
          total_floors: data.totalFloors ?? null,
          total_units: data.totalUnits ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          location_precision: data.locationPrecision ?? "approximate",
          duplicate_fingerprint: fingerprint,
          created_by_user_id: auth.user.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const attrResult = await validateAndSaveAttributes(trx, property.id, data.categoryId!, attributes);
      if (!attrResult.ok) {
        throw new AttributeValidationError(attrResult.error);
      }

      return property;
    });

    await logAdminAction(auth.user.id, "create", "property", result.id, { categoryId: data.categoryId, cityId: data.cityId });
    const resolvedAttributes = await getPropertyAttributes(result.id);
    return NextResponse.json({ property: result, attributes: resolvedAttributes }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AttributeValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

class AttributeValidationError extends Error {}

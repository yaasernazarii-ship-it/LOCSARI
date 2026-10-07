import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseOptionalId } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("neighborhood.view");
  if (auth.response) return auth.response;

  const { searchParams } = req.nextUrl;
  const cityId = parseOptionalId(searchParams.get("cityId"));
  const districtId = parseOptionalId(searchParams.get("districtId"));
  const marketZoneId = parseOptionalId(searchParams.get("marketZoneId"));
  if (cityId === null || districtId === null || marketZoneId === null) {
    return NextResponse.json({ error: "پارامترهای فیلتر نامعتبرند" }, { status: 400 });
  }

  let query = db.selectFrom("neighborhoods").selectAll().orderBy("sort_order", "asc");
  if (cityId !== undefined) query = query.where("city_id", "=", cityId);
  if (districtId !== undefined) query = query.where("district_id", "=", districtId);
  if (marketZoneId !== undefined) query = query.where("market_zone_id", "=", marketZoneId);

  const neighborhoods = await query.execute();
  return NextResponse.json({ neighborhoods });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("neighborhood.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const cityId = Number(body?.cityId);

  if (!isNonEmptyString(name, 100)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
  if (!isValidSlug(slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });
  if (!Number.isInteger(cityId) || cityId <= 0) return NextResponse.json({ error: "cityId نامعتبر است" }, { status: 400 });

  const city = await db.selectFrom("cities").select("id").where("id", "=", cityId).executeTakeFirst();
  if (!city) return NextResponse.json({ error: "شهر یافت نشد" }, { status: 400 });

  let districtId: number | null = null;
  if (body?.districtId != null) {
    districtId = Number(body.districtId);
    if (!Number.isInteger(districtId) || districtId <= 0)
      return NextResponse.json({ error: "districtId نامعتبر است" }, { status: 400 });
    const district = await db
      .selectFrom("districts")
      .select("id")
      .where("id", "=", districtId)
      .where("city_id", "=", cityId)
      .executeTakeFirst();
    if (!district) return NextResponse.json({ error: "منطقهٔ رسمی در این شهر یافت نشد" }, { status: 400 });
  }

  let marketZoneId: number | null = null;
  if (body?.marketZoneId != null) {
    marketZoneId = Number(body.marketZoneId);
    if (!Number.isInteger(marketZoneId) || marketZoneId <= 0)
      return NextResponse.json({ error: "marketZoneId نامعتبر است" }, { status: 400 });
    const marketZone = await db
      .selectFrom("market_zones")
      .select("id")
      .where("id", "=", marketZoneId)
      .where("city_id", "=", cityId)
      .executeTakeFirst();
    if (!marketZone) return NextResponse.json({ error: "منطقهٔ عرفی در این شهر یافت نشد" }, { status: 400 });
  }

  const latitude = body?.latitude != null ? Number(body.latitude) : null;
  const longitude = body?.longitude != null ? Number(body.longitude) : null;
  if (latitude !== null && !Number.isFinite(latitude)) return NextResponse.json({ error: "latitude نامعتبر است" }, { status: 400 });
  if (longitude !== null && !Number.isFinite(longitude)) return NextResponse.json({ error: "longitude نامعتبر است" }, { status: 400 });

  try {
    const neighborhood = await db
      .insertInto("neighborhoods")
      .values({
        city_id: cityId,
        district_id: districtId,
        market_zone_id: marketZoneId,
        name,
        slug,
        description: typeof body?.description === "string" ? body.description : null,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
        latitude,
        longitude,
        seo_title: typeof body?.seoTitle === "string" ? body.seoTitle : null,
        seo_description: typeof body?.seoDescription === "string" ? body.seoDescription : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "neighborhood", neighborhood.id, { name, slug, cityId });
    return NextResponse.json({ neighborhood }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug در این شهر قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}

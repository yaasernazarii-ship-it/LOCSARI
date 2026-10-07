import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOptionalId } from "@/lib/validation";

// GET /api/locations/neighborhoods?cityId=&districtId=&marketZoneId= (همه اختیاری)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cityId = parseOptionalId(searchParams.get("cityId"));
  const districtId = parseOptionalId(searchParams.get("districtId"));
  const marketZoneId = parseOptionalId(searchParams.get("marketZoneId"));

  if (cityId === null || districtId === null || marketZoneId === null) {
    return NextResponse.json({ error: "پارامترهای فیلتر نامعتبرند" }, { status: 400 });
  }

  let query = db
    .selectFrom("neighborhoods")
    .select([
      "id",
      "city_id",
      "district_id",
      "market_zone_id",
      "name",
      "slug",
      "description",
      "sort_order",
      "latitude",
      "longitude",
      "seo_title",
      "seo_description",
    ])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc");

  if (cityId !== undefined) query = query.where("city_id", "=", cityId);
  if (districtId !== undefined) query = query.where("district_id", "=", districtId);
  if (marketZoneId !== undefined) query = query.where("market_zone_id", "=", marketZoneId);

  const neighborhoods = await query.execute();
  return NextResponse.json({ neighborhoods });
}

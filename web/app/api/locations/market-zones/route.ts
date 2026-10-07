import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOptionalId } from "@/lib/validation";

// GET /api/locations/market-zones?cityId=X (اختیاری) — مناطق عرفی بازار املاک
export async function GET(req: NextRequest) {
  const cityId = parseOptionalId(req.nextUrl.searchParams.get("cityId"));
  if (cityId === null) return NextResponse.json({ error: "پارامتر cityId نامعتبر است" }, { status: 400 });

  let query = db
    .selectFrom("market_zones")
    .select(["id", "city_id", "name", "slug", "description", "sort_order"])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc");

  if (cityId !== undefined) query = query.where("city_id", "=", cityId);

  const marketZones = await query.execute();
  return NextResponse.json({ marketZones });
}

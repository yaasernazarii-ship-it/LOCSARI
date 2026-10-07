import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOptionalId } from "@/lib/validation";

// GET /api/locations/districts?cityId=X (اختیاری) — مناطق رسمی تقسیمات شهرداری
export async function GET(req: NextRequest) {
  const cityId = parseOptionalId(req.nextUrl.searchParams.get("cityId"));
  if (cityId === null) return NextResponse.json({ error: "پارامتر cityId نامعتبر است" }, { status: 400 });

  let query = db
    .selectFrom("districts")
    .select(["id", "city_id", "name", "slug", "description", "sort_order"])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc");

  if (cityId !== undefined) query = query.where("city_id", "=", cityId);

  const districts = await query.execute();
  return NextResponse.json({ districts });
}

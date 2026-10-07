import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOptionalId } from "@/lib/validation";

// GET /api/locations/cities?provinceId=X (اختیاری)
export async function GET(req: NextRequest) {
  const provinceId = parseOptionalId(req.nextUrl.searchParams.get("provinceId"));
  if (provinceId === null) return NextResponse.json({ error: "پارامتر provinceId نامعتبر است" }, { status: 400 });

  let query = db
    .selectFrom("cities")
    .select(["id", "province_id", "name", "slug", "sort_order"])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc");

  if (provinceId !== undefined) query = query.where("province_id", "=", provinceId);

  const cities = await query.execute();
  return NextResponse.json({ cities });
}

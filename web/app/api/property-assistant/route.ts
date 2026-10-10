import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePhone, parsePropertyQuery, searchPropertyQuery } from "@/lib/propertyAlerts";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`property-assistant:${getClientIp(req)}`, 20, 10 * 60_000)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  const body = await req.json().catch(() => null) as { query?: unknown; phone?: unknown; subscribe?: unknown } | null;
  const queryText = typeof body?.query === "string" ? body.query.trim().slice(0, 500) : "";
  if (!queryText) return NextResponse.json({ error: "درخواست ملک را بنویسید" }, { status: 400 });
  const parsed = await parsePropertyQuery(queryText);
  const results = await searchPropertyQuery(parsed);
  const wantsAlert = body?.subscribe === true || results.length === 0;
  let alertCreated = false;
  if (wantsAlert && body?.phone) {
    const phone = normalizePhone(String(body.phone));
    if (!phone) return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
    await db.insertInto("property_alerts").values({
      phone, query_text: queryText, deal_type: parsed.dealType, property_type: parsed.propertyType,
      neighborhood_id: parsed.neighborhoodId, min_price: parsed.minPrice, max_price: parsed.maxPrice,
      min_area: parsed.minArea, max_area: parsed.maxArea,
    }).execute();
    alertCreated = true;
  }
  return NextResponse.json({ parsed, results, needsPhone: wantsAlert && !alertCreated, alertCreated });
}

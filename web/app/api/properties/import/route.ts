import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { notifyPropertyAlerts } from "@/lib/propertyAlertNotifier";

const CATEGORY_SLUGS: Record<string, Record<string, string>> = {
  sale: { apartment: "kharid-forosh-khane-apartman", villa: "kharid-forosh-vila", land: "zamin-bagh", commercial: "kharid-forosh-edari-tejari-sanati" },
  mortgage_rent: { apartment: "rahn-ejare-khane-apartman", villa: "rahn-ejare-vila", land: "zamin-bagh", commercial: "rahn-ejare-edari-tejari-sanati" },
};

function sameSecret(value: string, secret: string) {
  const a = Buffer.from(value);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function text(value: unknown, limit: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= limit ? value.trim() : null;
}

function number(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٬,،\s تومانریال]/g, "");
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function logImport(data: { sourceId: string | null; sourceUrl: string | null; status: string; advertisementId?: number | null; propertyId?: number | null; errorMessage?: string | null }) {
  await db.insertInto("scraper_import_logs").values({ source_id: data.sourceId, source_url: data.sourceUrl, status: data.status, advertisement_id: data.advertisementId ?? null, property_id: data.propertyId ?? null, error_message: data.errorMessage ?? null }).execute();
}

export async function POST(req: NextRequest) {
  const secret = process.env.PROPERTY_IMPORT_API_KEY?.trim();
  const ownerId = Number(process.env.PROPERTY_IMPORT_USER_ID);
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : req.headers.get("x-api-key")?.trim() ?? "";
  if (!secret || !token || !sameSecret(token, secret)) return NextResponse.json({ error: "دسترسی نامعتبر است" }, { status: 401 });
  if (!Number.isInteger(ownerId) || ownerId <= 0) return NextResponse.json({ error: "حساب واردکننده پیکربندی نشده است" }, { status: 503 });
  const owner = await db.selectFrom("users").select("id").where("id", "=", ownerId).executeTakeFirst();
  if (!owner) return NextResponse.json({ error: "شناسه کاربر واردکننده در سامانه وجود ندارد" }, { status: 422 });
  if (!checkRateLimit(`property-import:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const title = text(body?.title, 300);
  const sourceId = text(body?.source_id, 255);
  const dealType = text(body?.deal_type, 30)?.toLowerCase();
  const propertyType = text(body?.property_type, 30)?.toLowerCase();
  const transactionType = dealType === "فروش" || dealType === "sale" ? "sale" : dealType === "رهن و اجاره" || dealType === "mortgage_rent" || dealType === "rent" ? "mortgage_rent" : null;
  const type = propertyType === "آپارتمان" || propertyType === "apartment" ? "apartment" : propertyType === "ویلایی" || propertyType === "villa" ? "villa" : propertyType === "زمین" || propertyType === "land" ? "land" : propertyType === "تجاری" || propertyType === "commercial" ? "commercial" : null;
  if (!body || !title || !sourceId || !transactionType || !type) return NextResponse.json({ error: "title، source_id، deal_type و property_type معتبر الزامی هستند" }, { status: 422 });

  const category = await db.selectFrom("categories").select("id").where("slug", "=", CATEGORY_SLUGS[transactionType][type]).executeTakeFirst();
  const city = await db.selectFrom("cities").select("id").where("name", "=", "ساری").executeTakeFirst();
  if (!category || !city) return NextResponse.json({ error: "تنظیمات دسته‌بندی یا شهر ساری کامل نیست" }, { status: 422 });
  const neighborhoodName = text(body.neighborhood, 120);
  const neighborhood = neighborhoodName ? await db.selectFrom("neighborhoods").select(["id", "district_id", "market_zone_id"]).where("city_id", "=", city.id).where("name", "=", neighborhoodName).executeTakeFirst() : null;
  const images = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === "string" && /^https?:\/\//.test(item) && item.length <= 2000).slice(0, 20) : [];
  const description = text(body.description, 10000);
  const sourceUrl = text(body.source_url, 2000);
  const status = "published";
  const now = new Date().toISOString();

  const existing = await db.selectFrom("advertisements").select(["id", "property_id"]).where("source_id", "=", sourceId).executeTakeFirst();
  if (existing) {
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("properties").set({ title, description, area: number(body.area), bedrooms: number(body.rooms), built_year: number(body.build_year), neighborhood_id: neighborhood?.id ?? null, district_id: neighborhood?.district_id ?? null, market_zone_id: neighborhood?.market_zone_id ?? null, updated_at: now }).where("id", "=", existing.property_id).execute();
      await trx.updateTable("advertisements").set({ title, description, price: number(body.price_total), deposit: number(body.deposit_price), monthly_rent: number(body.rent_price), source_url: sourceUrl, source_contact_phone: text(body.contact_phone, 50), status, published_at: status === "published" ? now : null, updated_at: now }).where("id", "=", existing.id).execute();
    });
    await logImport({ sourceId, sourceUrl, status: "updated", advertisementId: existing.id, propertyId: existing.property_id });
    return NextResponse.json({ id: existing.property_id, advertisementId: existing.id, updated: true });
  }

  const titleDuplicate = await db.selectFrom("advertisements").select(["id", "property_id"]).where("title", "=", title).where("status", "in", ["published", "pending_review"]).executeTakeFirst();
  if (titleDuplicate) {
    await logImport({ sourceId, sourceUrl, status: "duplicate", advertisementId: titleDuplicate.id, propertyId: titleDuplicate.property_id });
    return NextResponse.json({ id: titleDuplicate.property_id, advertisementId: titleDuplicate.id, duplicate: true });
  }

  const result = await db.transaction().execute(async (trx) => {
    const property = await trx.insertInto("properties").values({ category_id: category.id, city_id: city.id, neighborhood_id: neighborhood?.id ?? null, district_id: neighborhood?.district_id ?? null, market_zone_id: neighborhood?.market_zone_id ?? null, title, description, area: number(body.area), bedrooms: number(body.rooms), built_year: number(body.build_year), created_by_user_id: ownerId }).returning("id").executeTakeFirstOrThrow();
    const ad = await trx.insertInto("advertisements").values({ property_id: property.id, created_by_user_id: ownerId, title, description, slug: `import-${sourceId.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)}-${property.id}`, transaction_type: transactionType, price: number(body.price_total), deposit: number(body.deposit_price), monthly_rent: number(body.rent_price), status, source_id: sourceId, source_url: sourceUrl, source_contact_phone: text(body.contact_phone, 50), published_at: status === "published" ? now : null }).returning("id").executeTakeFirstOrThrow();
    for (const [sortOrder, url] of images.entries()) await trx.insertInto("property_media").values({ property_id: property.id, storage_key: url, url, alt_text: title, is_primary: sortOrder === 0, sort_order: sortOrder }).execute();
    return { propertyId: property.id, advertisementId: ad.id };
  });
  await logImport({ sourceId, sourceUrl, status: "created", advertisementId: result.advertisementId, propertyId: result.propertyId });
  await notifyPropertyAlerts(result.advertisementId, result.propertyId);
  return NextResponse.json({ id: result.propertyId, advertisementId: result.advertisementId, created: true }, { status: 201 });
}

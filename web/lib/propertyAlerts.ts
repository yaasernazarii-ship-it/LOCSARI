import { db } from "@/lib/db";

export type PropertyQuery = {
  dealType: "sale" | "mortgage_rent" | null;
  propertyType: "apartment" | "villa" | "land" | null;
  neighborhoodId: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
};

function digits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٬،,]/g, "");
}

function amount(value: string) {
  const normalized = digits(value);
  const number = Number(normalized.replace(/\D/g, ""));
  if (!number) return null;
  if (/میلیارد/.test(value)) return number * 1_000_000_000;
  if (/میلیون/.test(value)) return number * 1_000_000;
  return number;
}

export async function parsePropertyQuery(queryText: string): Promise<PropertyQuery> {
  const text = queryText.trim();
  const neighborhoods = await db.selectFrom("neighborhoods").select(["id", "name"]).where("is_active", "=", true).execute();
  const neighborhood = neighborhoods.find((item) => text.includes(item.name));
  const priceMatch = text.match(/(?:تا|حداکثر|زیر)\s*([۰-۹\d٬،,]+)\s*(میلیارد|میلیون)?/);
  const areaMatch = text.match(/([۰-۹\d٬،,]+)\s*متر/);
  return {
    dealType: /رهن|اجاره/.test(text) ? "mortgage_rent" : /خرید|فروش/.test(text) ? "sale" : null,
    propertyType: /ویلا|کلبه/.test(text) ? "villa" : /زمین|باغ/.test(text) ? "land" : /آپارتمان|خانه/.test(text) ? "apartment" : null,
    neighborhoodId: neighborhood?.id ?? null,
    minPrice: null,
    maxPrice: priceMatch ? amount(priceMatch[1] + (priceMatch[2] ?? "")) : null,
    minArea: areaMatch ? amount(areaMatch[1]) : null,
    maxArea: areaMatch ? amount(areaMatch[1]) : null,
  };
}

export async function searchPropertyQuery(query: PropertyQuery) {
  let builder = db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("categories", "categories.id", "properties.category_id")
    .leftJoin("property_media", (join) => join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true))
    .select(["advertisements.id", "advertisements.slug", "advertisements.title", "advertisements.transaction_type", "advertisements.price", "advertisements.deposit", "advertisements.monthly_rent", "properties.area", "property_media.url as primary_image"])
    .where("advertisements.status", "=", "published")
    .where("properties.is_active", "=", true);
  if (query.dealType) builder = builder.where("advertisements.transaction_type", "=", query.dealType);
  if (query.neighborhoodId) builder = builder.where("properties.neighborhood_id", "=", query.neighborhoodId);
  if (query.maxPrice !== null) builder = builder.where("advertisements.price", "<=", String(query.maxPrice));
  if (query.minArea !== null) builder = builder.where("properties.area", "=", String(query.minArea));
  if (query.propertyType) {
    const slug = query.propertyType === "villa" ? "%vila%" : query.propertyType === "land" ? "%zamin%" : "%apartman%";
    builder = builder.where("categories.slug", "like", slug);
  }
  return builder.orderBy("advertisements.published_at", "desc").limit(20).execute();
}

export function normalizePhone(value: string) {
  const phone = digits(value).replace(/\s|-/g, "").replace(/^\+98/, "0").replace(/^0098/, "0");
  return /^09\d{9}$/.test(phone) ? phone : null;
}

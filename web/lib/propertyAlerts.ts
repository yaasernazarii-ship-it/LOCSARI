import { db } from "@/lib/db";

export type PropertyQuery = {
  dealType: "sale" | "mortgage_rent" | null;
  propertyType: "apartment" | "villa" | "land" | null;
  neighborhoodId: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minDeposit: number | null;
  maxDeposit: number | null;
  minRent: number | null;
  maxRent: number | null;
  minArea: number | null;
  maxArea: number | null;
  bedrooms: number | null;
  fullMortgage: boolean;
};

const NUMBER = "[۰-۹٠-٩\\d٬،,]+";
const NUMBER_WORDS: Record<string, number> = { "یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6 };

function digits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،,]/g, "");
}

function normalized(value: string) {
  return digits(value).toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[‌\s\-ـ]/g, "").replace(/(?:محله|شهرک|بلوار|خیابان|میدان|کوی|منطقه)/g, "");
}

function amount(value: string) {
  const compact = digits(value);
  const number = Number(compact.replace(/\D/g, ""));
  if (!number) return null;
  if (/میلیارد/.test(value)) return number * 1_000_000_000;
  if (/میلیون/.test(value)) return number * 1_000_000;
  if (/هزار/.test(value)) return number * 1_000;
  return number;
}

function priceRange(text: string, label?: string) {
  const prefix = label ? `(?:${label})\\s*(?:تا|حداکثر|حدود|:)?\\s*` : "";
  const unit = "\\s*(میلیارد|میلیون|هزار)?";
  const between = text.match(new RegExp(`${prefix}بین\\s*(${NUMBER})${unit}\\s*(?:تا|الی|\-)\\s*(${NUMBER})${unit}`));
  if (between) return { min: amount(between[1] + (between[2] ?? "")), max: amount(between[3] + (between[4] ?? "")) };
  const exact = text.match(new RegExp(`${prefix}(${NUMBER})${unit}`));
  if (!exact) return { min: null, max: null };
  const value = amount(exact[1] + (exact[2] ?? ""));
  const before = text.slice(0, exact.index).slice(-24);
  if (/(?:تا|حداکثر|زیر)/.test(before)) return { min: null, max: value };
  if (/(?:از|حداقل|بیشتر)/.test(before)) return { min: value, max: null };
  return { min: value, max: value };
}

function areaRange(text: string) {
  const between = text.match(new RegExp(`بین\\s*(${NUMBER})\\s*متر\\s*(?:تا|الی|\-)\\s*(${NUMBER})\\s*متر`));
  if (between) return { min: amount(between[1]), max: amount(between[2]) };
  const exact = text.match(new RegExp(`(${NUMBER})\\s*متر`));
  if (!exact) return { min: null, max: null };
  const value = amount(exact[1]);
  const before = text.slice(0, exact.index).slice(-24);
  if (/(?:تا|حداکثر|زیر)/.test(before)) return { min: null, max: value };
  if (/(?:از|حداقل|بیشتر)/.test(before)) return { min: value, max: null };
  return { min: value, max: value };
}

function bedroomCount(text: string) {
  const numeric = digits(text).match(/(\d+)\s*(?:خوابه|خواب)/);
  if (numeric) return Number(numeric[1]);
  const word = text.match(/(یک|دو|سه|چهار|پنج|شش)\s*(?:خوابه|خواب)/);
  return word ? NUMBER_WORDS[word[1]] : null;
}

export async function parsePropertyQuery(queryText: string): Promise<PropertyQuery> {
  const text = queryText.trim();
  const searchText = normalized(text);
  const neighborhoods = await db.selectFrom("neighborhoods").select(["id", "name"]).where("is_active", "=", true).execute();
  const neighborhood = neighborhoods.find((item) => {
    const name = normalized(item.name);
    return name.length > 2 && (searchText.includes(name) || name.includes(searchText));
  });
  const fullMortgage = /رهن\s*کامل|فول\s*رهن/.test(text);
  const deposit = priceRange(text, "ودیعه|رهن(?:\\s*کامل)?|پیش(?:پرداخت)?");
  const rent = priceRange(text, "اجاره|ماهانه|کرایه");
  const labelledPurchase = priceRange(text, "قیمت|خرید|فروش");
  const purchase = labelledPurchase.min !== null || labelledPurchase.max !== null ? labelledPurchase : priceRange(text);
  const area = areaRange(text);
  const dealType = /رهن|اجاره|ودیعه|ماهانه|کرایه/.test(text) ? "mortgage_rent" : /خرید|فروش/.test(text) ? "sale" : null;
  return {
    dealType,
    propertyType: /ویلا|کلبه/.test(text) ? "villa" : /زمین|باغ/.test(text) ? "land" : /آپارتمان|اپارتمان|خانه/.test(text) ? "apartment" : null,
    neighborhoodId: neighborhood?.id ?? null,
    minPrice: dealType === "sale" ? purchase.min : null,
    maxPrice: dealType === "sale" ? purchase.max : null,
    minDeposit: deposit.min,
    maxDeposit: deposit.max,
    minRent: fullMortgage ? null : rent.min,
    maxRent: fullMortgage ? 0 : rent.max,
    minArea: area.min,
    maxArea: area.max,
    bedrooms: bedroomCount(text),
    fullMortgage,
  };
}

export async function searchPropertyQuery(query: PropertyQuery) {
  let builder = db.selectFrom("advertisements").innerJoin("properties", "properties.id", "advertisements.property_id").innerJoin("categories", "categories.id", "properties.category_id").leftJoin("property_media", (join) => join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)).select(["advertisements.id", "advertisements.slug", "advertisements.title", "advertisements.transaction_type", "advertisements.price", "advertisements.deposit", "advertisements.monthly_rent", "properties.area", "property_media.url as primary_image"]).where("advertisements.status", "=", "published").where("properties.is_active", "=", true);
  if (query.dealType) builder = builder.where("advertisements.transaction_type", "=", query.dealType);
  if (query.neighborhoodId) builder = builder.where("properties.neighborhood_id", "=", query.neighborhoodId);
  if (query.minPrice !== null) builder = builder.where("advertisements.price", ">=", String(query.minPrice));
  if (query.maxPrice !== null) builder = builder.where("advertisements.price", "<=", String(query.maxPrice));
  if (query.minDeposit !== null) builder = builder.where("advertisements.deposit", ">=", String(query.minDeposit));
  if (query.maxDeposit !== null) builder = builder.where("advertisements.deposit", "<=", String(query.maxDeposit));
  if (query.minRent !== null) builder = builder.where("advertisements.monthly_rent", ">=", String(query.minRent));
  if (query.maxRent !== null) builder = builder.where((eb) => eb.or([eb("advertisements.monthly_rent", "<=", String(query.maxRent)), eb("advertisements.monthly_rent", "is", null)]));
  if (query.minArea !== null) builder = builder.where("properties.area", ">=", String(query.minArea));
  if (query.maxArea !== null) builder = builder.where("properties.area", "<=", String(query.maxArea));
  if (query.bedrooms !== null) builder = builder.where("properties.bedrooms", "=", query.bedrooms);
  if (query.propertyType) builder = builder.where("categories.slug", "like", query.propertyType === "villa" ? "%vila%" : query.propertyType === "land" ? "%zamin%" : "%apartman%");
  return builder.orderBy("advertisements.published_at", "desc").limit(20).execute();
}

export function normalizePhone(value: string) {
  const phone = digits(value).replace(/\s|-/g, "").replace(/^\+98/, "0").replace(/^0098/, "0");
  return /^09\d{9}$/.test(phone) ? phone : null;
}

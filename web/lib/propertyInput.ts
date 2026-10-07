// اعتبارسنجی مشترک فیلدهای پایهٔ Property (بخش ۳، ۱۴ و ۱۵ پرامپت فاز ۳)
// برای POST (partial=false، همه‌چیز اجباری) و PATCH (partial=true، فقط فیلدهای ارسال‌شده) استفاده می‌شود.

import { db } from "./db";
import { DbOrTx } from "./propertyAttributes";
import { isNonEmptyString, isValidLocationPrecision, isValidNonNegativeInteger, isValidNonNegativeNumber, isValidPositiveNumber } from "./validation";

const ALLOWED_CITY_SLUG = "sari"; // بخش ۱۵: LocationSari فعلاً فقط برای شهر ساری است

export interface PropertyBaseFields {
  categoryId: number;
  subcategoryId: number | null;
  cityId: number;
  districtId: number | null;
  marketZoneId: number | null;
  neighborhoodId: number | null;
  title: string;
  description: string | null;
  area: number | null;
  builtArea: number | null;
  landArea: number | null;
  bedrooms: number | null;
  builtYear: number | null;
  floor: number | null;
  totalFloors: number | null;
  totalUnits: number | null;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: string;
}

export type PropertyValidationResult =
  | { ok: true; data: Partial<PropertyBaseFields> & { categoryId?: number } }
  | { ok: false; error: string };

function optionalNumber(raw: unknown, field: string, validator: (v: unknown) => boolean): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (!validator(raw)) return { ok: false, error: `${field} نامعتبر است` };
  return { ok: true, value: raw as number };
}

/**
 * اعتبارسنجی فیلدهای پایهٔ Property به‌همراه بررسی تعلق سلسله‌مراتبی مکان (شهر=ساری، منطقه/محله متعلق به همان شهر).
 * partial=true یعنی PATCH: فقط کلیدهای واقعاً موجود در body بررسی و در خروجی برگردانده می‌شوند.
 */
export async function validatePropertyInput(
  body: Record<string, unknown>,
  opts: { partial: boolean },
  dbOrTx: DbOrTx = db
): Promise<PropertyValidationResult> {
  const data: Record<string, unknown> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const need = (key: string) => !opts.partial || has(key);

  // ---- title / description ----
  if (need("title")) {
    if (!isNonEmptyString(body.title, 200)) return { ok: false, error: "title نامعتبر است" };
    data.title = (body.title as string).trim();
  }
  if (has("description")) {
    data.description = typeof body.description === "string" ? body.description : null;
  }

  // ---- category / subcategory ----
  let categoryId: number | undefined;
  if (need("categoryId")) {
    categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return { ok: false, error: "categoryId نامعتبر است" };
    const category = await dbOrTx
      .selectFrom("categories")
      .select(["id", "is_active"])
      .where("id", "=", categoryId)
      .executeTakeFirst();
    if (!category) return { ok: false, error: "دسته‌بندی یافت نشد" };
    if (!category.is_active) return { ok: false, error: "دسته‌بندی غیرفعال است" };
    data.categoryId = categoryId;
  }

  if (has("subcategoryId")) {
    if (body.subcategoryId === null) {
      data.subcategoryId = null;
    } else {
      const subcategoryId = Number(body.subcategoryId);
      if (!Number.isInteger(subcategoryId) || subcategoryId <= 0) return { ok: false, error: "subcategoryId نامعتبر است" };
      const sub = await dbOrTx
        .selectFrom("categories")
        .select(["id", "parent_id", "is_active"])
        .where("id", "=", subcategoryId)
        .executeTakeFirst();
      if (!sub) return { ok: false, error: "زیردسته یافت نشد" };
      if (!sub.is_active) return { ok: false, error: "زیردسته غیرفعال است" };
      const effectiveCategoryId = categoryId ?? (data.categoryId as number | undefined);
      if (effectiveCategoryId && sub.parent_id !== effectiveCategoryId)
        return { ok: false, error: "زیردسته باید فرزند دستهٔ انتخاب‌شده باشد" };
      data.subcategoryId = subcategoryId;
    }
  }

  // ---- city (فقط ساری) / district / market zone / neighborhood ----
  let cityId: number | undefined;
  if (need("cityId")) {
    cityId = Number(body.cityId);
    if (!Number.isInteger(cityId) || cityId <= 0) return { ok: false, error: "cityId نامعتبر است" };
    const city = await dbOrTx.selectFrom("cities").select(["id", "slug", "is_active"]).where("id", "=", cityId).executeTakeFirst();
    if (!city || !city.is_active) return { ok: false, error: "شهر یافت نشد یا غیرفعال است" };
    if (city.slug !== ALLOWED_CITY_SLUG) return { ok: false, error: "LocationSari فعلاً فقط برای شهر ساری فعال است" };
    data.cityId = cityId;
  }
  const effectiveCityId = cityId ?? (data.cityId as number | undefined);

  if (has("districtId")) {
    if (body.districtId === null) {
      data.districtId = null;
    } else {
      const districtId = Number(body.districtId);
      if (!Number.isInteger(districtId) || districtId <= 0) return { ok: false, error: "districtId نامعتبر است" };
      const district = await dbOrTx
        .selectFrom("districts")
        .select(["id", "city_id", "is_active"])
        .where("id", "=", districtId)
        .executeTakeFirst();
      if (!district || !district.is_active) return { ok: false, error: "منطقهٔ رسمی یافت نشد یا غیرفعال است" };
      if (effectiveCityId && district.city_id !== effectiveCityId) return { ok: false, error: "منطقه متعلق به این شهر نیست" };
      data.districtId = districtId;
    }
  }

  if (has("marketZoneId")) {
    if (body.marketZoneId === null) {
      data.marketZoneId = null;
    } else {
      const marketZoneId = Number(body.marketZoneId);
      if (!Number.isInteger(marketZoneId) || marketZoneId <= 0) return { ok: false, error: "marketZoneId نامعتبر است" };
      const mz = await dbOrTx
        .selectFrom("market_zones")
        .select(["id", "city_id", "is_active"])
        .where("id", "=", marketZoneId)
        .executeTakeFirst();
      if (!mz || !mz.is_active) return { ok: false, error: "منطقهٔ عرفی یافت نشد یا غیرفعال است" };
      if (effectiveCityId && mz.city_id !== effectiveCityId) return { ok: false, error: "منطقهٔ عرفی متعلق به این شهر نیست" };
      data.marketZoneId = marketZoneId;
    }
  }

  if (has("neighborhoodId")) {
    if (body.neighborhoodId === null) {
      data.neighborhoodId = null;
    } else {
      const neighborhoodId = Number(body.neighborhoodId);
      if (!Number.isInteger(neighborhoodId) || neighborhoodId <= 0) return { ok: false, error: "neighborhoodId نامعتبر است" };
      const n = await dbOrTx
        .selectFrom("neighborhoods")
        .select(["id", "city_id", "is_active"])
        .where("id", "=", neighborhoodId)
        .executeTakeFirst();
      if (!n || !n.is_active) return { ok: false, error: "محله یافت نشد یا غیرفعال است" };
      if (effectiveCityId && n.city_id !== effectiveCityId) return { ok: false, error: "محله متعلق به این شهر نیست" };
      data.neighborhoodId = neighborhoodId;
    }
  }

  // ---- اعداد پایه ----
  const numericFields: Array<[string, (v: unknown) => boolean]> = [
    ["area", isValidPositiveNumber],
    ["builtArea", isValidNonNegativeNumber],
    ["landArea", isValidNonNegativeNumber],
    ["bedrooms", isValidNonNegativeInteger],
    ["builtYear", (v) => typeof v === "number" && Number.isInteger(v) && v >= 1300 && v <= 1500],
    ["floor", (v) => typeof v === "number" && Number.isInteger(v) && v >= -2 && v <= 30],
    ["totalFloors", isValidNonNegativeInteger],
    ["totalUnits", isValidNonNegativeInteger],
  ];
  for (const [key, validator] of numericFields) {
    if (has(key)) {
      const res = optionalNumber(body[key], key, validator);
      if (!res.ok) return res;
      data[key] = res.value;
    }
  }

  if (has("latitude")) {
    if (body.latitude !== null && (typeof body.latitude !== "number" || body.latitude < -90 || body.latitude > 90))
      return { ok: false, error: "latitude نامعتبر است" };
    data.latitude = body.latitude ?? null;
  }
  if (has("longitude")) {
    if (body.longitude !== null && (typeof body.longitude !== "number" || body.longitude < -180 || body.longitude > 180))
      return { ok: false, error: "longitude نامعتبر است" };
    data.longitude = body.longitude ?? null;
  }

  if (has("locationPrecision")) {
    if (!isValidLocationPrecision(body.locationPrecision)) return { ok: false, error: "locationPrecision نامعتبر است" };
    data.locationPrecision = body.locationPrecision;
  } else if (!opts.partial) {
    data.locationPrecision = "approximate";
  }

  return { ok: true, data: data as Partial<PropertyBaseFields> };
}

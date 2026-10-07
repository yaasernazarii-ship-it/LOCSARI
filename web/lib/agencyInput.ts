// اعتبارسنجی مشترک فیلدهای Agency (فاز ۶، بخش ۴ و ۱۰) — برای POST (اپلای، partial=false)
// و PATCH (ویرایش خودِ آژانس، partial=true) استفاده می‌شود. الگو مشابه lib/propertyInput.ts.

import { db } from "./db";
import { isNonEmptyString, isValidHttpUrl } from "./validation";

const ALLOWED_CITY_SLUG = "sari"; // بخش ۴: Agency فقط برای شهر ساری قابل ثبت است

export interface AgencyBaseFields {
  name: string;
  description: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  cityId: number;
  districtId: number | null;
  marketZoneId: number | null;
  neighborhoodId: number | null;
  latitude: number | null;
  longitude: number | null;
}

export type AgencyValidationResult =
  | { ok: true; data: Partial<AgencyBaseFields> }
  | { ok: false; error: string };

export async function validateAgencyInput(
  body: Record<string, unknown>,
  opts: { partial: boolean }
): Promise<AgencyValidationResult> {
  const data: Record<string, unknown> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const need = (key: string) => !opts.partial || has(key);

  if (need("name")) {
    if (!isNonEmptyString(body.name, 150)) return { ok: false, error: "نام آژانس نامعتبر است" };
    data.name = (body.name as string).trim();
  }

  if (has("description")) {
    data.description = typeof body.description === "string" ? body.description.slice(0, 5000) : null;
  }

  for (const [key, maxLen] of [
    ["phone", 20],
    ["mobile", 20],
    ["email", 150],
    ["address", 2000],
  ] as const) {
    if (has(key)) {
      const raw = body[key as keyof typeof body];
      if (raw === null || raw === "") {
        data[key] = null;
      } else if (typeof raw === "string" && raw.length <= maxLen) {
        data[key] = raw.trim();
      } else {
        return { ok: false, error: `${key} نامعتبر است` };
      }
    }
  }

  if (has("website")) {
    if (body.website === null || body.website === "") {
      data.website = null;
    } else if (isValidHttpUrl(body.website)) {
      data.website = body.website;
    } else {
      return { ok: false, error: "website نامعتبر است" };
    }
  }

  let cityId: number | undefined;
  if (need("cityId")) {
    cityId = Number(body.cityId);
    if (!Number.isInteger(cityId) || cityId <= 0) return { ok: false, error: "cityId نامعتبر است" };
    const city = await db.selectFrom("cities").select(["id", "slug", "is_active"]).where("id", "=", cityId).executeTakeFirst();
    if (!city || !city.is_active) return { ok: false, error: "شهر یافت نشد یا غیرفعال است" };
    if (city.slug !== ALLOWED_CITY_SLUG) return { ok: false, error: "ثبت آژانس فعلاً فقط برای شهر ساری فعال است" };
    data.cityId = cityId;
  }
  const effectiveCityId = cityId ?? (data.cityId as number | undefined);

  if (has("districtId")) {
    if (body.districtId === null) {
      data.districtId = null;
    } else {
      const districtId = Number(body.districtId);
      if (!Number.isInteger(districtId) || districtId <= 0) return { ok: false, error: "districtId نامعتبر است" };
      const district = await db
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
      const mz = await db
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
      const n = await db
        .selectFrom("neighborhoods")
        .select(["id", "city_id", "is_active"])
        .where("id", "=", neighborhoodId)
        .executeTakeFirst();
      if (!n || !n.is_active) return { ok: false, error: "محله یافت نشد یا غیرفعال است" };
      if (effectiveCityId && n.city_id !== effectiveCityId) return { ok: false, error: "محله متعلق به این شهر نیست" };
      data.neighborhoodId = neighborhoodId;
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

  return { ok: true, data: data as Partial<AgencyBaseFields> };
}

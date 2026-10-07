// تشخیص آگهی/ملک تکراری (بخش ۱۶ و ۱۷ پرامپت فاز ۳)
// یک Fingerprint/Similarity ساده و قطعیت‌نداشته؛ فقط POTENTIAL_DUPLICATE تولید می‌کند تا Admin بررسی کند.

import { createHash } from "crypto";
import { DbOrTx } from "./propertyAttributes";

export interface FingerprintInput {
  categoryId: number;
  neighborhoodId: number | null;
  area: number | null;
  bedrooms: number | null;
  builtYear: number | null;
}

/** سطل‌بندی مساحت به گام ۵متری تا تفاوت‌های جزئی مانع تطبیق نشوند */
function areaBucket(area: number | null): string {
  if (area === null) return "na";
  return String(Math.round(area / 5) * 5);
}

export function computeDuplicateFingerprint(input: FingerprintInput): string {
  const raw = `${input.categoryId}:${input.neighborhoodId ?? "na"}:${areaBucket(input.area)}:${input.bedrooms ?? "na"}:${input.builtYear ?? "na"}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 40);
}

export interface DuplicateCandidate {
  propertyId: number;
  score: number;
  reasons: string[];
}

const SCORE_THRESHOLD = 70;

/**
 * نامزدهای احتمالاً تکراری برای یک Property را می‌یابد.
 * مقایسه فقط در محدودهٔ همان category_id انجام می‌شود؛ امتیاز بر اساس تطبیق محله، مساحت،
 * تعداد خواب، سال ساخت و (در صورت وجود) نزدیکی قیمت آخرین آگهی فعال محاسبه می‌شود.
 */
export async function findDuplicateCandidates(
  tx: DbOrTx,
  self: {
    propertyId: number;
    categoryId: number;
    neighborhoodId: number | null;
    cityId: number;
    area: number | null;
    bedrooms: number | null;
    builtYear: number | null;
  },
  price: number | null
): Promise<DuplicateCandidate[]> {
  let query = tx
    .selectFrom("properties")
    .select(["id", "neighborhood_id", "area", "bedrooms", "built_year"])
    .where("category_id", "=", self.categoryId)
    .where("city_id", "=", self.cityId)
    .where("is_active", "=", true)
    .where("id", "!=", self.propertyId);

  if (self.neighborhoodId !== null) {
    query = query.where("neighborhood_id", "=", self.neighborhoodId);
  }

  const candidates = await query.execute();
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);
  const latestPrices = await tx
    .selectFrom("advertisements")
    .select(["property_id", "price", "status", "created_at"])
    .where("property_id", "in", candidateIds)
    .where("status", "not in", ["rejected", "archived"])
    .orderBy("created_at", "desc")
    .execute();

  const priceByProperty = new Map<number, number>();
  for (const row of latestPrices) {
    if (!priceByProperty.has(row.property_id) && row.price !== null) {
      priceByProperty.set(row.property_id, Number(row.price));
    }
  }

  const results: DuplicateCandidate[] = [];
  for (const c of candidates) {
    let score = 40; // همان دسته‌بندی و همان شهر همواره برقرار است (شرط query)
    const reasons: string[] = ["دسته‌بندی و شهر یکسان"];

    if (self.neighborhoodId !== null && c.neighborhood_id === self.neighborhoodId) {
      score += 20;
      reasons.push("محلهٔ یکسان");
    }

    const candidateArea = c.area !== null ? Number(c.area) : null;
    if (self.area !== null && candidateArea !== null && Math.abs(self.area - candidateArea) <= 5) {
      score += 15;
      reasons.push("مساحت مشابه");
    }

    if (self.bedrooms !== null && c.bedrooms !== null && self.bedrooms === c.bedrooms) {
      score += 10;
      reasons.push("تعداد خواب یکسان");
    }

    if (self.builtYear !== null && c.built_year !== null && Math.abs(self.builtYear - c.built_year) <= 1) {
      score += 10;
      reasons.push("سال ساخت مشابه");
    }

    const candidatePrice = priceByProperty.get(c.id);
    if (price !== null && candidatePrice !== undefined && candidatePrice > 0) {
      const diffRatio = Math.abs(price - candidatePrice) / candidatePrice;
      if (diffRatio <= 0.1) {
        score += 15;
        reasons.push("قیمت نزدیک");
      }
    }

    if (score >= SCORE_THRESHOLD) {
      results.push({ propertyId: c.id, score: Math.min(score, 100), reasons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** ثبت نامزدهای تکراری یافته‌شده در جدول property_duplicate_matches و علامت‌گذاری آگهی */
export async function flagDuplicates(
  tx: DbOrTx,
  propertyId: number,
  advertisementId: number,
  candidates: DuplicateCandidate[]
): Promise<boolean> {
  if (candidates.length === 0) return false;

  for (const candidate of candidates) {
    await tx
      .insertInto("property_duplicate_matches")
      .values({
        property_id: propertyId,
        matched_property_id: candidate.propertyId,
        advertisement_id: advertisementId,
        score: candidate.score,
        reason: candidate.reasons.join("، "),
      })
      .execute();
  }

  await tx.updateTable("advertisements").set({ is_potential_duplicate: true }).where("id", "=", advertisementId).execute();
  return true;
}

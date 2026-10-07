// اعتبارسنجی کامل Query Parameters جستجو (بخش ۴، ۵ تا ۱۳، ۱۴، ۱۵، ۲۴ پرامپت فاز ۴)
// هیچ مقدار خامی مستقیم به SQL نمی‌رود؛ همه از این‌جا عبور و نوع/تعلق‌شان بررسی می‌شود.

import { db } from "../db";
import { isValidTransactionType } from "../validation";
import { SEARCH_SORTS, SearchFilters, SearchSort } from "./types";

const SARI_CITY_SLUG = "sari";

// نام پارامترهای رزروشدهٔ جستجو — هر پارامتر دیگری (در صورت وجود categoryId) به‌عنوان
// فیلتر ویژگی پویا (بخش ۱۳) تفسیر می‌شود، مثلاً elevator=true یا landUse=agricultural.
const RESERVED_PARAMS = new Set([
  "q",
  "category",
  "categoryId",
  "subcategory",
  "subcategoryId",
  "transactionType",
  "district",
  "districtId",
  "marketZone",
  "marketZoneId",
  "neighborhood",
  "neighborhoodId",
  "minPrice",
  "maxPrice",
  "minDeposit",
  "maxDeposit",
  "minMonthlyRent",
  "maxMonthlyRent",
  "minArea",
  "maxArea",
  "bedrooms",
  "builtYear",
  "floor",
  "totalFloors",
  "agencyId",
  "consultantId",
  "page",
  "limit",
  "sort",
  "north",
  "south",
  "east",
  "west",
]);

export type ValidationResult = { ok: true; filters: SearchFilters } | { ok: false; error: string };

function parsePositiveInt(raw: string | null, field: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return { ok: false, error: `${field} نامعتبر است` };
  return { ok: true, value: n };
}

function parseNonNegativeNumber(raw: string | null, field: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${field} نامعتبر است` };
  return { ok: true, value: n };
}

function parseLat(raw: string | null): number | null | "invalid" {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -90 || n > 90) return "invalid";
  return n;
}
function parseLng(raw: string | null): number | null | "invalid" {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -180 || n > 180) return "invalid";
  return n;
}

/**
 * فیلترهای قیمتی مرتبط با هر نوع معامله (بخش ۱۰). اگر transactionType مشخص شده باشد و کاربر
 * فیلتر نامرتبط بفرستد، خطای ۴۰۰ شفاف برمی‌گردد (رفتار مستند در گزارش نهایی).
 */
const PRICE_BASED_TYPES = new Set(["sale", "pre_sale", "partnership"]);
const RENT_BASED_TYPES = new Set(["rent", "mortgage_rent", "short_term_rent"]);

export async function validateSearchParams(searchParams: URLSearchParams): Promise<ValidationResult> {
  const q = searchParams.get("q");
  const cleanQ = q && q.trim().length > 0 ? q.trim().slice(0, 100) : null;

  // ---- category / subcategory ----
  const categoryIdRaw = searchParams.get("categoryId") ?? searchParams.get("category");
  let categoryId: number | null = null;
  if (categoryIdRaw) {
    const n = Number(categoryIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "categoryId نامعتبر است" };
    const category = await db.selectFrom("categories").select(["id", "is_active"]).where("id", "=", n).executeTakeFirst();
    if (!category || !category.is_active) return { ok: false, error: "دسته‌بندی یافت نشد یا غیرفعال است" };
    categoryId = n;
  }

  const subcategoryIdRaw = searchParams.get("subcategoryId") ?? searchParams.get("subcategory");
  let subcategoryId: number | null = null;
  if (subcategoryIdRaw) {
    const n = Number(subcategoryIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "subcategoryId نامعتبر است" };
    const sub = await db.selectFrom("categories").select(["id", "parent_id", "is_active"]).where("id", "=", n).executeTakeFirst();
    if (!sub || !sub.is_active) return { ok: false, error: "زیردسته یافت نشد یا غیرفعال است" };
    if (categoryId !== null && sub.parent_id !== categoryId) return { ok: false, error: "زیردسته باید فرزند دستهٔ انتخاب‌شده باشد" };
    subcategoryId = n;
  }

  // ---- transaction type ----
  const transactionTypeRaw = searchParams.get("transactionType");
  let transactionType: string | null = null;
  if (transactionTypeRaw) {
    if (!isValidTransactionType(transactionTypeRaw)) return { ok: false, error: "transactionType نامعتبر است" };
    transactionType = transactionTypeRaw;
  }

  // ---- location (فقط ساری، بخش ۷) ----
  const sariCity = await db.selectFrom("cities").select(["id"]).where("slug", "=", SARI_CITY_SLUG).where("is_active", "=", true).executeTakeFirst();
  if (!sariCity) return { ok: false, error: "شهر ساری در سامانه یافت نشد" };

  const districtIdRaw = searchParams.get("districtId") ?? searchParams.get("district");
  let districtId: number | null = null;
  if (districtIdRaw) {
    const n = Number(districtIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "districtId نامعتبر است" };
    const d = await db.selectFrom("districts").select(["id", "city_id", "is_active"]).where("id", "=", n).executeTakeFirst();
    if (!d || !d.is_active || d.city_id !== sariCity.id) return { ok: false, error: "منطقهٔ رسمی نامعتبر است" };
    districtId = n;
  }

  const marketZoneIdRaw = searchParams.get("marketZoneId") ?? searchParams.get("marketZone");
  let marketZoneId: number | null = null;
  if (marketZoneIdRaw) {
    const n = Number(marketZoneIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "marketZoneId نامعتبر است" };
    const mz = await db.selectFrom("market_zones").select(["id", "city_id", "is_active"]).where("id", "=", n).executeTakeFirst();
    if (!mz || !mz.is_active || mz.city_id !== sariCity.id) return { ok: false, error: "منطقهٔ عرفی نامعتبر است" };
    marketZoneId = n;
  }

  const neighborhoodIdRaw = searchParams.get("neighborhoodId") ?? searchParams.get("neighborhood");
  let neighborhoodId: number | null = null;
  if (neighborhoodIdRaw) {
    const n = Number(neighborhoodIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "neighborhoodId نامعتبر است" };
    const nb = await db
      .selectFrom("neighborhoods")
      .select(["id", "city_id", "district_id", "market_zone_id", "is_active"])
      .where("id", "=", n)
      .executeTakeFirst();
    if (!nb || !nb.is_active || nb.city_id !== sariCity.id) return { ok: false, error: "محله نامعتبر است" };
    // بخش ۸ و ۹: اگر district یا marketZone هم داده شده، محله باید متعلق به همان باشد (جلوگیری از ترکیب متناقض)
    if (districtId !== null && nb.district_id !== null && nb.district_id !== districtId)
      return { ok: false, error: "محله متعلق به منطقهٔ رسمی انتخاب‌شده نیست" };
    if (marketZoneId !== null && nb.market_zone_id !== null && nb.market_zone_id !== marketZoneId)
      return { ok: false, error: "محله متعلق به منطقهٔ عرفی انتخاب‌شده نیست" };
    neighborhoodId = n;
  }

  // ---- آگهی‌دهنده: آژانس/مشاور (فاز ۶، بخش ۱۷) — فقط پروفایل approved+active قابل فیلتر است ----
  const agencyIdRaw = searchParams.get("agencyId");
  let agencyId: number | null = null;
  if (agencyIdRaw) {
    const n = Number(agencyIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "agencyId نامعتبر است" };
    const agency = await db
      .selectFrom("agencies")
      .select(["id", "verification_status", "is_active"])
      .where("id", "=", n)
      .executeTakeFirst();
    if (!agency || agency.verification_status !== "approved" || !agency.is_active) return { ok: false, error: "آژانس یافت نشد" };
    agencyId = n;
  }

  const consultantIdRaw = searchParams.get("consultantId");
  let consultantId: number | null = null;
  if (consultantIdRaw) {
    const n = Number(consultantIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "consultantId نامعتبر است" };
    const consultant = await db
      .selectFrom("consultants")
      .select(["id", "verification_status", "is_active"])
      .where("id", "=", n)
      .executeTakeFirst();
    if (!consultant || consultant.verification_status !== "approved" || !consultant.is_active) return { ok: false, error: "مشاور یافت نشد" };
    consultantId = n;
  }

  // ---- قیمت / رهن / اجاره (بخش ۱۰) ----
  const priceFields = [
    ["minPrice", "minPrice"],
    ["maxPrice", "maxPrice"],
  ] as const;
  const rentFields = [
    ["minDeposit", "minDeposit"],
    ["maxDeposit", "maxDeposit"],
    ["minMonthlyRent", "minMonthlyRent"],
    ["maxMonthlyRent", "maxMonthlyRent"],
  ] as const;

  const priceProvided = priceFields.some(([k]) => searchParams.get(k) !== null);
  const rentProvided = rentFields.some(([k]) => searchParams.get(k) !== null);

  if (transactionType) {
    if (RENT_BASED_TYPES.has(transactionType) && priceProvided) {
      return { ok: false, error: "برای این نوع معامله، minPrice/maxPrice معتبر نیست (از minDeposit/maxDeposit/minMonthlyRent/maxMonthlyRent استفاده کنید)" };
    }
    if (PRICE_BASED_TYPES.has(transactionType) && rentProvided) {
      return { ok: false, error: "برای این نوع معامله، فیلترهای رهن/اجاره معتبر نیست (از minPrice/maxPrice استفاده کنید)" };
    }
  }
  // اگر transactionType مشخص نشده، هر دو دسته فیلتر مجازند و هرکدام مستقیماً روی ستون متناظر خودش اعمال می‌شود
  // (آگهی‌های نوع دیگر که آن ستون در آن‌ها null است، به‌طور طبیعی از نتیجه خارج می‌شوند).

  const minPriceR = parseNonNegativeNumber(searchParams.get("minPrice"), "minPrice");
  if (!minPriceR.ok) return minPriceR;
  const maxPriceR = parseNonNegativeNumber(searchParams.get("maxPrice"), "maxPrice");
  if (!maxPriceR.ok) return maxPriceR;
  if (minPriceR.value !== null && maxPriceR.value !== null && minPriceR.value > maxPriceR.value)
    return { ok: false, error: "minPrice نباید بزرگ‌تر از maxPrice باشد" };

  const minDepositR = parseNonNegativeNumber(searchParams.get("minDeposit"), "minDeposit");
  if (!minDepositR.ok) return minDepositR;
  const maxDepositR = parseNonNegativeNumber(searchParams.get("maxDeposit"), "maxDeposit");
  if (!maxDepositR.ok) return maxDepositR;
  if (minDepositR.value !== null && maxDepositR.value !== null && minDepositR.value > maxDepositR.value)
    return { ok: false, error: "minDeposit نباید بزرگ‌تر از maxDeposit باشد" };

  const minRentR = parseNonNegativeNumber(searchParams.get("minMonthlyRent"), "minMonthlyRent");
  if (!minRentR.ok) return minRentR;
  const maxRentR = parseNonNegativeNumber(searchParams.get("maxMonthlyRent"), "maxMonthlyRent");
  if (!maxRentR.ok) return maxRentR;
  if (minRentR.value !== null && maxRentR.value !== null && minRentR.value > maxRentR.value)
    return { ok: false, error: "minMonthlyRent نباید بزرگ‌تر از maxMonthlyRent باشد" };

  // ---- مساحت (بخش ۱۱) ----
  const minAreaR = parseNonNegativeNumber(searchParams.get("minArea"), "minArea");
  if (!minAreaR.ok) return minAreaR;
  if (minAreaR.value === 0) return { ok: false, error: "minArea نامعتبر است" }; // صفر بی‌معنی است، باید مثبت باشد
  const maxAreaR = parseNonNegativeNumber(searchParams.get("maxArea"), "maxArea");
  if (!maxAreaR.ok) return maxAreaR;
  if (maxAreaR.value === 0) return { ok: false, error: "maxArea نامعتبر است" };
  if (minAreaR.value !== null && maxAreaR.value !== null && minAreaR.value > maxAreaR.value)
    return { ok: false, error: "minArea نباید بزرگ‌تر از maxArea باشد" };

  // ---- ویژگی‌های عمومی ملک ----
  const bedroomsR = parsePositiveInt(searchParams.get("bedrooms"), "bedrooms");
  if (!bedroomsR.ok) return bedroomsR;
  const builtYearR = parsePositiveInt(searchParams.get("builtYear"), "builtYear");
  if (!builtYearR.ok) return builtYearR;
  const floorR = parsePositiveInt(searchParams.get("floor"), "floor");
  if (!floorR.ok) return floorR;
  const totalFloorsR = parsePositiveInt(searchParams.get("totalFloors"), "totalFloors");
  if (!totalFloorsR.ok) return totalFloorsR;

  // ---- Bounding Box (بخش ۲۴) ----
  const north = parseLat(searchParams.get("north"));
  const south = parseLat(searchParams.get("south"));
  const east = parseLng(searchParams.get("east"));
  const west = parseLng(searchParams.get("west"));
  if (north === "invalid" || south === "invalid" || east === "invalid" || west === "invalid")
    return { ok: false, error: "محدودهٔ نقشه (bounding box) نامعتبر است" };
  const bboxProvided = [north, south, east, west].some((v) => v !== null);
  let bbox: SearchFilters["bbox"] = null;
  if (bboxProvided) {
    if (north === null || south === null || east === null || west === null)
      return { ok: false, error: "برای فیلتر نقشه، هر چهار مقدار north/south/east/west لازم است" };
    if (south > north) return { ok: false, error: "south نباید بزرگ‌تر از north باشد" };
    bbox = { north, south, east, west };
  }

  // ---- Pagination ----
  const pageR = parsePositiveInt(searchParams.get("page"), "page");
  if (!pageR.ok) return pageR;
  const page = pageR.value && pageR.value > 0 ? pageR.value : 1;

  const limitRaw = searchParams.get("limit");
  let limit = 20;
  if (limitRaw !== null) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "limit نامعتبر است" };
    if (n > 50) return { ok: false, error: "limit حداکثر ۵۰ است" };
    limit = n;
  }

  // ---- Sort ----
  const sortRaw = searchParams.get("sort");
  let sort: SearchSort = "newest";
  if (sortRaw) {
    if (!(SEARCH_SORTS as readonly string[]).includes(sortRaw)) return { ok: false, error: "sort نامعتبر است" };
    sort = sortRaw as SearchSort;
  }

  // ---- فیلترهای ویژگی پویا (بخش ۱۳) — هر پارامتر غیررزروشده ----
  const attrs: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (value === "") continue;
    if (categoryId === null) return { ok: false, error: `برای فیلتر ویژگی «${key}»، categoryId الزامی است` };
    attrs[key] = value;
  }

  return {
    ok: true,
    filters: {
      q: cleanQ,
      categoryId,
      subcategoryId,
      transactionType,
      districtId,
      marketZoneId,
      neighborhoodId,
      minPrice: minPriceR.value,
      maxPrice: maxPriceR.value,
      minDeposit: minDepositR.value,
      maxDeposit: maxDepositR.value,
      minMonthlyRent: minRentR.value,
      maxMonthlyRent: maxRentR.value,
      minArea: minAreaR.value,
      maxArea: maxAreaR.value,
      bedrooms: bedroomsR.value,
      builtYear: builtYearR.value,
      floor: floorR.value,
      totalFloors: totalFloorsR.value,
      agencyId,
      consultantId,
      attrs,
      bbox,
      sort,
      page,
      limit,
    },
  };
}

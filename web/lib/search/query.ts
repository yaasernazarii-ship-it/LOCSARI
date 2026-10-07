// موتور اصلی Query جستجو (بخش ۲ تا ۱۷، ۲۴، ۲۷ تا ۲۹ پرامپت فاز ۴)
// تمام فیلترها/Sort/Pagination اینجا متمرکز است؛ Route Handlerها فقط این تابع را صدا می‌زنند.

import { sql, RawBuilder } from "kysely";
import { db } from "../db";
import { cached } from "../cache";
import { SearchFilters, SearchResponse, SearchResultItem } from "./types";
import { resolveAttributeFilters } from "./filters";
import { publicMapCoords } from "./mapPrivacy";

async function getSariCityId(): Promise<number> {
  return cached("search:sari-city-id", 5 * 60 * 1000, async () => {
    const city = await db
      .selectFrom("cities")
      .select("id")
      .where("slug", "=", "sari")
      .where("is_active", "=", true)
      .executeTakeFirstOrThrow();
    return city.id;
  });
}

export type SearchExecResult = { ok: true; data: SearchResponse } | { ok: false; error: string };

/**
 * قانون بسیار مهم بخش ۲: فقط آگهی status=published + expires_at>now (یا null) + ملک is_active=true
 * مستقیم در سطح Query اعمال می‌شود — مستقل از هر Query Parameter دیگری، هرگز قابل دور زدن نیست.
 */
export async function runSearch(filters: SearchFilters): Promise<SearchExecResult> {
  const sariCityId = await getSariCityId();

  let attrConditions: RawBuilder<boolean>[] = [];
  if (filters.categoryId !== null && Object.keys(filters.attrs).length > 0) {
    const resolved = await resolveAttributeFilters(filters.categoryId, filters.attrs);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    attrConditions = resolved.conditions;
  }

  let base = db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("categories", "categories.id", "properties.category_id")
    .leftJoin("districts", "districts.id", "properties.district_id")
    .leftJoin("market_zones", "market_zones.id", "properties.market_zone_id")
    .leftJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
    .leftJoin("consultants", (join) =>
      join
        .onRef("consultants.id", "=", "advertisements.consultant_id")
        .on("consultants.verification_status", "=", "approved")
        .on("consultants.is_active", "=", true)
    )
    .leftJoin("agencies", (join) =>
      join
        .onRef("agencies.id", "=", "advertisements.agency_id")
        .on("agencies.verification_status", "=", "approved")
        .on("agencies.is_active", "=", true)
    )
    .where("advertisements.status", "=", "published")
    .where((eb) => eb.or([eb("advertisements.expires_at", "is", null), eb("advertisements.expires_at", ">", new Date())]))
    .where("properties.is_active", "=", true)
    .where("properties.city_id", "=", sariCityId);

  if (filters.categoryId !== null) base = base.where("properties.category_id", "=", filters.categoryId);
  if (filters.subcategoryId !== null) base = base.where("properties.subcategory_id", "=", filters.subcategoryId);
  if (filters.transactionType !== null) base = base.where("advertisements.transaction_type", "=", filters.transactionType);
  if (filters.districtId !== null) base = base.where("properties.district_id", "=", filters.districtId);
  if (filters.marketZoneId !== null) base = base.where("properties.market_zone_id", "=", filters.marketZoneId);
  if (filters.neighborhoodId !== null) base = base.where("properties.neighborhood_id", "=", filters.neighborhoodId);

  if (filters.minPrice !== null) base = base.where("advertisements.price", ">=", String(filters.minPrice));
  if (filters.maxPrice !== null) base = base.where("advertisements.price", "<=", String(filters.maxPrice));
  if (filters.minDeposit !== null) base = base.where("advertisements.deposit", ">=", String(filters.minDeposit));
  if (filters.maxDeposit !== null) base = base.where("advertisements.deposit", "<=", String(filters.maxDeposit));
  if (filters.minMonthlyRent !== null) base = base.where("advertisements.monthly_rent", ">=", String(filters.minMonthlyRent));
  if (filters.maxMonthlyRent !== null) base = base.where("advertisements.monthly_rent", "<=", String(filters.maxMonthlyRent));

  if (filters.minArea !== null) base = base.where("properties.area", ">=", String(filters.minArea));
  if (filters.maxArea !== null) base = base.where("properties.area", "<=", String(filters.maxArea));
  if (filters.bedrooms !== null) base = base.where("properties.bedrooms", "=", filters.bedrooms);
  if (filters.builtYear !== null) base = base.where("properties.built_year", "=", filters.builtYear);
  if (filters.floor !== null) base = base.where("properties.floor", "=", filters.floor);
  if (filters.totalFloors !== null) base = base.where("properties.total_floors", "=", filters.totalFloors);
  if (filters.agencyId !== null) base = base.where("advertisements.agency_id", "=", filters.agencyId);
  if (filters.consultantId !== null) base = base.where("advertisements.consultant_id", "=", filters.consultantId);

  if (filters.bbox) {
    base = base
      .where("properties.latitude", ">=", filters.bbox.south)
      .where("properties.latitude", "<=", filters.bbox.north)
      .where("properties.longitude", ">=", filters.bbox.west)
      .where("properties.longitude", "<=", filters.bbox.east);
  }

  if (filters.q) {
    // جستجوی بدون فاصله نیز باید عنوان/توضیحات دارای فاصله را پیدا کند؛ مثلاً «امیرمازندرانی» برای «امیر مازندرانی».
    base = base.where(sql<boolean>`
      advertisements.search_vector @@ plainto_tsquery('simple', ${filters.q})
      or regexp_replace(coalesce(advertisements.title, '') || ' ' || coalesce(advertisements.description, ''), '[[:space:]]+', '', 'g')
        ilike '%' || regexp_replace(${filters.q}, '[[:space:]]+', '', 'g') || '%'
    `);
  }

  for (const cond of attrConditions) {
    base = base.where(cond);
  }

  // ---- Count (بدون Limit/Offset/Order، همان فیلترها) ----
  const countRow = await base.select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow();
  const total = Number(countRow.count);

  // ---- Sort (فقط از whitelist، بخش ۱۴) ----
  // اولویت با آگهی‌های VIP فعال (is_vip=true و منقضی‌نشده) است؛ داخل هر گروه، Sort انتخابی کاربر اعمال می‌شود.
  let sorted = base.orderBy(
    sql`case when advertisements.is_vip and (advertisements.vip_expires_at is null or advertisements.vip_expires_at > now()) then 0 else 1 end`
  );
  switch (filters.sort) {
    case "oldest":
      sorted = sorted.orderBy("advertisements.published_at", "asc");
      break;
    case "price_asc":
      sorted = sorted.orderBy(sql`advertisements.price asc nulls last`);
      break;
    case "price_desc":
      sorted = sorted.orderBy(sql`advertisements.price desc nulls last`);
      break;
    case "area_asc":
      sorted = sorted.orderBy(sql`properties.area asc nulls last`);
      break;
    case "area_desc":
      sorted = sorted.orderBy(sql`properties.area desc nulls last`);
      break;
    case "relevance":
      if (filters.q) {
        sorted = sorted.orderBy(sql`ts_rank(advertisements.search_vector, plainto_tsquery('simple', ${filters.q})) desc`);
      } else {
        sorted = sorted.orderBy("advertisements.published_at", "desc");
      }
      break;
    case "newest":
    default:
      sorted = sorted.orderBy("advertisements.published_at", "desc");
  }

  const offset = (filters.page - 1) * filters.limit;

  const rows = await sorted
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .select([
      "advertisements.id as ad_id",
      "advertisements.slug as ad_slug",
      "advertisements.title as ad_title",
      "advertisements.transaction_type as ad_transaction_type",
      "advertisements.price as ad_price",
      "advertisements.deposit as ad_deposit",
      "advertisements.monthly_rent as ad_monthly_rent",
      "advertisements.published_at as ad_published_at",
      "advertisements.is_vip as ad_is_vip",
      "advertisements.vip_expires_at as ad_vip_expires_at",
      "properties.area as p_area",
      "properties.bedrooms as p_bedrooms",
      "properties.latitude as p_latitude",
      "properties.longitude as p_longitude",
      "properties.location_precision as p_location_precision",
      "categories.id as category_id",
      "categories.name as category_name",
      "categories.slug as category_slug",
      "districts.name as district_name",
      "market_zones.name as market_zone_name",
      "neighborhoods.name as neighborhood_name",
      "neighborhoods.latitude as n_latitude",
      "neighborhoods.longitude as n_longitude",
      "property_media.url as primary_image",
      "consultants.display_name as consultant_name",
      "consultants.slug as consultant_slug",
      "agencies.name as agency_name",
      "agencies.slug as agency_slug",
    ])
    .limit(filters.limit)
    .offset(offset)
    .execute();

  const items: SearchResultItem[] = rows.map((r) => {
    const coords = publicMapCoords({
      precision: r.p_location_precision,
      latitude: r.p_latitude,
      longitude: r.p_longitude,
      neighborhoodLat: r.n_latitude,
      neighborhoodLng: r.n_longitude,
    });
    return {
      id: r.ad_id,
      slug: r.ad_slug,
      title: r.ad_title,
      category: { id: r.category_id, name: r.category_name, slug: r.category_slug },
      transactionType: r.ad_transaction_type,
      price: r.ad_price !== null ? Number(r.ad_price) : null,
      deposit: r.ad_deposit !== null ? Number(r.ad_deposit) : null,
      monthlyRent: r.ad_monthly_rent !== null ? Number(r.ad_monthly_rent) : null,
      area: r.p_area !== null ? Number(r.p_area) : null,
      bedrooms: r.p_bedrooms,
      location: {
        district: r.district_name ?? null,
        marketZone: r.market_zone_name ?? null,
        neighborhood: r.neighborhood_name ?? null,
        lat: coords.lat,
        lng: coords.lng,
      },
      primaryImage: r.primary_image ?? null,
      publishedAt: r.ad_published_at ? new Date(r.ad_published_at).toISOString() : null,
      isVip: r.ad_is_vip && (r.ad_vip_expires_at === null || new Date(r.ad_vip_expires_at) > new Date()),
      publisher: {
        consultantName: r.consultant_name ?? null,
        consultantSlug: r.consultant_slug ?? null,
        agencyName: r.agency_name ?? null,
        agencySlug: r.agency_slug ?? null,
      },
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  return {
    ok: true,
    data: {
      items,
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages,
      hasNextPage: filters.page < totalPages,
    },
  };
}

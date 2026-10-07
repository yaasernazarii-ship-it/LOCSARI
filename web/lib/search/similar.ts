// آگهی‌های مشابه (بخش «Similar Advertisements» فاز ۵) — بر اساس همان دسته‌بندی و نزدیک‌ترین قیمت،
// از موتور جستجوی موجود جدا نگه داشته شده چون قاعدهٔ Sort/Exclude متفاوتی دارد (بدون افزودن پیچیدگی به runSearch).

import { sql } from "kysely";
import { db } from "../db";
import { publicMapCoords } from "./mapPrivacy";
import { SearchResultItem } from "./types";

export async function getSimilarAdvertisements(params: {
  excludeAdId: number;
  categoryId: number;
  cityId: number;
  transactionType: string;
  price: number | null;
  limit?: number;
}): Promise<SearchResultItem[]> {
  const limit = params.limit ?? 4;

  let query = db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("categories", "categories.id", "properties.category_id")
    .leftJoin("districts", "districts.id", "properties.district_id")
    .leftJoin("market_zones", "market_zones.id", "properties.market_zone_id")
    .leftJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
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
    .where("properties.city_id", "=", params.cityId)
    .where("properties.category_id", "=", params.categoryId)
    .where("advertisements.id", "!=", params.excludeAdId)
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
    ]);

  // اولویت با همان نوع معامله؛ سپس نزدیک‌ترین قیمت به آگهی فعلی، در غیر این صورت جدیدترین
  if (params.price !== null) {
    query = query.orderBy(sql`abs(coalesce(advertisements.price, 0) - ${params.price})`, "asc");
  } else {
    query = query.orderBy("advertisements.published_at", "desc");
  }

  const rows = await query.limit(limit).execute();

  return rows.map((r) => {
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
}

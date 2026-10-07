// منطق مشترک واکشی جزئیات یک آگهی عمومی بر اساس slug (بخش ۲۶ پرامپت فاز ۴)
// هم توسط app/api/advertisements/slug/[slug]/route.ts و هم مستقیماً توسط صفحهٔ سرور /agahi/[slug] استفاده می‌شود.

import { db } from "../db";
import { publicMapCoords } from "./mapPrivacy";

export interface AdvertisementDetail {
  id: number;
  publicCode: string;
  slug: string;
  title: string;
  description: string | null;
  transactionType: string;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  publishedAt: string | null;
  category: { id: number; name: string; slug: string };
  cityId: number;
  property: {
    area: number | null;
    builtArea: number | null;
    landArea: number | null;
    bedrooms: number | null;
    builtYear: number | null;
    floor: number | null;
    totalFloors: number | null;
    totalUnits: number | null;
  };
  location: {
    district: string | null;
    marketZone: string | null;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
  };
  media: { id: number; url: string; altText: string | null; isPrimary: boolean }[];
  attributes: { key: string; label: string; type: string; value: string | number | boolean | null }[];
  vip: { isVip: boolean; videoUrl: string | null };
  publisher: {
    consultant: { name: string; slug: string; avatar: string | null } | null;
    agency: { name: string; slug: string; logo: string | null } | null;
  };
}

export async function getAdvertisementDetail(slug: string): Promise<AdvertisementDetail | null> {
  if (!slug || typeof slug !== "string" || slug.length > 220) return null;

  const row = await db
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
    .where("advertisements.slug", "=", slug)
    .where("advertisements.status", "=", "published")
    .where((eb) => eb.or([eb("advertisements.expires_at", "is", null), eb("advertisements.expires_at", ">", new Date())]))
    .where("properties.is_active", "=", true)
    .select([
      "advertisements.id as ad_id",
      "advertisements.public_code as ad_public_code",
      "advertisements.slug as ad_slug",
      "advertisements.title as ad_title",
      "advertisements.description as ad_description",
      "advertisements.transaction_type as ad_transaction_type",
      "advertisements.price as ad_price",
      "advertisements.deposit as ad_deposit",
      "advertisements.monthly_rent as ad_monthly_rent",
      "advertisements.published_at as ad_published_at",
      "advertisements.is_vip as ad_is_vip",
      "advertisements.vip_video_url as ad_vip_video_url",
      "properties.id as property_id",
      "properties.city_id as city_id",
      "properties.area as p_area",
      "properties.built_area as p_built_area",
      "properties.land_area as p_land_area",
      "properties.bedrooms as p_bedrooms",
      "properties.built_year as p_built_year",
      "properties.floor as p_floor",
      "properties.total_floors as p_total_floors",
      "properties.total_units as p_total_units",
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
      "consultants.display_name as consultant_name",
      "consultants.slug as consultant_slug",
      "consultants.avatar as consultant_avatar",
      "agencies.name as agency_name",
      "agencies.slug as agency_slug",
      "agencies.logo as agency_logo",
    ])
    .executeTakeFirst();

  if (!row) return null;

  const media = await db
    .selectFrom("property_media")
    .select(["id", "url", "alt_text", "is_primary", "sort_order"])
    .where("property_id", "=", row.property_id)
    .orderBy("sort_order", "asc")
    .execute();

  const attributes = await db
    .selectFrom("property_attributes")
    .innerJoin("category_fields", "category_fields.id", "property_attributes.field_id")
    .select([
      "category_fields.key as key",
      "category_fields.label_fa as label",
      "category_fields.field_type as field_type",
      "property_attributes.value_text as value_text",
      "property_attributes.value_number as value_number",
      "property_attributes.value_boolean as value_boolean",
      "property_attributes.value_date as value_date",
    ])
    .where("property_attributes.property_id", "=", row.property_id)
    .where("category_fields.is_active", "=", true)
    .execute();

  const coords = publicMapCoords({
    precision: row.p_location_precision,
    latitude: row.p_latitude,
    longitude: row.p_longitude,
    neighborhoodLat: row.n_latitude,
    neighborhoodLng: row.n_longitude,
  });

  return {
    id: row.ad_id,
    publicCode: row.ad_public_code,
    slug: row.ad_slug,
    title: row.ad_title,
    description: row.ad_description,
    transactionType: row.ad_transaction_type,
    price: row.ad_price !== null ? Number(row.ad_price) : null,
    deposit: row.ad_deposit !== null ? Number(row.ad_deposit) : null,
    monthlyRent: row.ad_monthly_rent !== null ? Number(row.ad_monthly_rent) : null,
    publishedAt: row.ad_published_at ? new Date(row.ad_published_at).toISOString() : null,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    cityId: row.city_id,
    property: {
      area: row.p_area !== null ? Number(row.p_area) : null,
      builtArea: row.p_built_area !== null ? Number(row.p_built_area) : null,
      landArea: row.p_land_area !== null ? Number(row.p_land_area) : null,
      bedrooms: row.p_bedrooms,
      builtYear: row.p_built_year,
      floor: row.p_floor,
      totalFloors: row.p_total_floors,
      totalUnits: row.p_total_units,
    },
    location: {
      district: row.district_name ?? null,
      marketZone: row.market_zone_name ?? null,
      neighborhood: row.neighborhood_name ?? null,
      lat: coords.lat,
      lng: coords.lng,
    },
    media: media.map((m) => ({ id: m.id, url: m.url, altText: m.alt_text, isPrimary: m.is_primary })),
    vip: { isVip: row.ad_is_vip, videoUrl: row.ad_is_vip ? row.ad_vip_video_url : null },
    attributes: attributes.map((a) => ({
      key: a.key,
      label: a.label,
      type: a.field_type,
      value: a.value_boolean ?? a.value_number ?? a.value_text ?? a.value_date ?? null,
    })),
    publisher: {
      consultant: row.consultant_slug
        ? { name: row.consultant_name!, slug: row.consultant_slug, avatar: row.consultant_avatar }
        : null,
      agency: row.agency_slug ? { name: row.agency_name!, slug: row.agency_slug, logo: row.agency_logo } : null,
    },
  };
}

// واکشی پروفایل عمومی Agency/Consultant (فاز ۶، بخش ۱۳ و ۱۴) — فقط approved+active قابل مشاهدهٔ عمومی است.

import { db } from "./db";
import { getSocialLinks } from "./socialLinks";

export interface PublicAgencyProfile {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  coverImage: string | null;
  address: string | null;
  cityName: string;
  districtName: string | null;
  marketZoneName: string | null;
  neighborhoodName: string | null;
  adCount: number;
  consultants: { id: number; displayName: string; slug: string; avatar: string | null }[];
  socialLinks: { provider: string | null; url: string }[];
}

export async function getPublicAgencyProfile(slug: string): Promise<PublicAgencyProfile | null> {
  if (!slug || typeof slug !== "string" || slug.length > 200) return null;

  const row = await db
    .selectFrom("agencies")
    .innerJoin("cities", "cities.id", "agencies.city_id")
    .leftJoin("districts", "districts.id", "agencies.district_id")
    .leftJoin("market_zones", "market_zones.id", "agencies.market_zone_id")
    .leftJoin("neighborhoods", "neighborhoods.id", "agencies.neighborhood_id")
    .select([
      "agencies.id",
      "agencies.name",
      "agencies.slug",
      "agencies.description",
      "agencies.phone",
      "agencies.mobile",
      "agencies.email",
      "agencies.website",
      "agencies.logo",
      "agencies.cover_image",
      "agencies.address",
      "cities.name as city_name",
      "districts.name as district_name",
      "market_zones.name as market_zone_name",
      "neighborhoods.name as neighborhood_name",
    ])
    .where("agencies.slug", "=", slug)
    .where("agencies.verification_status", "=", "approved")
    .where("agencies.is_active", "=", true)
    .executeTakeFirst();

  if (!row) return null;

  const [adCountRow, consultants, socialLinks] = await Promise.all([
    db
      .selectFrom("advertisements")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("agency_id", "=", row.id)
      .where("status", "=", "published")
      .executeTakeFirst(),
    db
      .selectFrom("consultants")
      .select(["id", "display_name", "slug", "avatar"])
      .where("agency_id", "=", row.id)
      .where("verification_status", "=", "approved")
      .where("is_active", "=", true)
      .execute(),
    getSocialLinks(db, "agency", row.id),
  ]);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    website: row.website,
    logo: row.logo,
    coverImage: row.cover_image,
    address: row.address,
    cityName: row.city_name,
    districtName: row.district_name ?? null,
    marketZoneName: row.market_zone_name ?? null,
    neighborhoodName: row.neighborhood_name ?? null,
    adCount: Number(adCountRow?.count ?? 0),
    consultants: consultants.map((c) => ({ id: c.id, displayName: c.display_name, slug: c.slug, avatar: c.avatar })),
    socialLinks: socialLinks.map((s) => ({ provider: s.provider, url: s.url })),
  };
}

export interface PublicConsultantProfile {
  id: number;
  displayName: string;
  slug: string;
  bio: string | null;
  phone: string | null;
  avatar: string | null;
  licenseNumber: string | null;
  agency: { name: string; slug: string; logo: string | null } | null;
  adCount: number;
  socialLinks: { provider: string | null; url: string }[];
}

export async function getPublicConsultantProfile(slug: string): Promise<PublicConsultantProfile | null> {
  if (!slug || typeof slug !== "string" || slug.length > 200) return null;

  const row = await db
    .selectFrom("consultants")
    .leftJoin("agencies", (join) =>
      join
        .onRef("agencies.id", "=", "consultants.agency_id")
        .on("agencies.verification_status", "=", "approved")
        .on("agencies.is_active", "=", true)
    )
    .select([
      "consultants.id",
      "consultants.display_name",
      "consultants.slug",
      "consultants.bio",
      "consultants.phone",
      "consultants.avatar",
      "consultants.license_number",
      "agencies.name as agency_name",
      "agencies.slug as agency_slug",
      "agencies.logo as agency_logo",
    ])
    .where("consultants.slug", "=", slug)
    .where("consultants.verification_status", "=", "approved")
    .where("consultants.is_active", "=", true)
    .executeTakeFirst();

  if (!row) return null;

  const [adCountRow, socialLinks] = await Promise.all([
    db
      .selectFrom("advertisements")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("consultant_id", "=", row.id)
      .where("status", "=", "published")
      .executeTakeFirst(),
    getSocialLinks(db, "consultant", row.id),
  ]);

  return {
    id: row.id,
    displayName: row.display_name,
    slug: row.slug,
    bio: row.bio,
    phone: row.phone,
    avatar: row.avatar,
    licenseNumber: row.license_number,
    agency: row.agency_slug ? { name: row.agency_name!, slug: row.agency_slug, logo: row.agency_logo } : null,
    adCount: Number(adCountRow?.count ?? 0),
    socialLinks: socialLinks.map((s) => ({ provider: s.provider, url: s.url })),
  };
}

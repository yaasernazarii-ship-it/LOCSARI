import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import AdCard, { AdCardItem } from "@/components/AdCard";
import { getSiteContent } from "@/lib/siteContent";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// صفحهٔ اصلی عمومی سایت — هیرو + جستجوی سریع + جدیدترین آگهی‌ها.

export default async function HomePage() {
  const [user, content] = await Promise.all([getCurrentUser(), getSiteContent()]);

  const adRows = await db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .leftJoin("districts", "districts.id", "properties.district_id")
    .leftJoin("market_zones", "market_zones.id", "properties.market_zone_id")
    .leftJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .select([
      "advertisements.id",
      "advertisements.slug",
      "advertisements.title",
      "advertisements.transaction_type",
      "advertisements.price",
      "advertisements.deposit",
      "advertisements.monthly_rent",
      "advertisements.published_at",
      "advertisements.is_vip",
      "advertisements.vip_expires_at",
      "properties.area",
      "properties.bedrooms",
      "districts.name as district_name",
      "market_zones.name as market_zone_name",
      "neighborhoods.name as neighborhood_name",
      "property_media.url as primary_image",
    ])
    .where("advertisements.status", "=", "published")
    .where((eb) => eb.or([eb("advertisements.expires_at", "is", null), eb("advertisements.expires_at", ">", new Date())]))
    .where("properties.is_active", "=", true)
    .orderBy("advertisements.published_at", "desc")
    .limit(8)
    .execute();

  const favoriteIds = new Set<number>();
  if (user && adRows.length > 0) {
    const favRows = await db
      .selectFrom("favorites")
      .select("advertisement_id")
      .where("user_id", "=", user.id)
      .where(
        "advertisement_id",
        "in",
        adRows.map((r) => r.id)
      )
      .execute();
    favRows.forEach((r) => favoriteIds.add(r.advertisement_id));
  }

  const items: AdCardItem[] = adRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    transactionType: r.transaction_type,
    price: r.price !== null ? Number(r.price) : null,
    deposit: r.deposit !== null ? Number(r.deposit) : null,
    monthlyRent: r.monthly_rent !== null ? Number(r.monthly_rent) : null,
    area: r.area !== null ? Number(r.area) : null,
    bedrooms: r.bedrooms,
    primaryImage: r.primary_image ?? null,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    location: {
      district: r.district_name ?? null,
      marketZone: r.market_zone_name ?? null,
      neighborhood: r.neighborhood_name ?? null,
    },
    isVip: r.is_vip && (r.vip_expires_at === null || new Date(r.vip_expires_at) > new Date()),
  }));

  return (
    <>
      <section className="home-hero" style={content["home.hero.image"] ? { backgroundImage: `url("${content["home.hero.image"]}")` } : undefined}>
        <div className="home-hero__inner">
          <h1>{content["home.hero_title"]}</h1>
          <p>{content["home.hero_description"]}</p>
          <form action="/amlak" method="GET" className="home-hero__search">
            <input type="text" name="q" placeholder={content["home.search_placeholder"]} />
            <button type="submit" className="btn-primary">
              جستجو
            </button>
          </form>
          <div className="home-hero__links">
            <Link href="/account/advertisements/new">ثبت آگهی رایگان</Link>
            <span>·</span>
            <Link href="/amlak">مشاهدهٔ همهٔ آگهی‌ها</Link>
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="home-section">
          <div className="home-section__header">
            <h2>{content["home.latest_title"]}</h2>
            <Link href="/amlak">مشاهدهٔ همه ←</Link>
          </div>
          <div className="result-grid">
            {items.map((item) => (
              <AdCard key={item.id} item={item} isLoggedIn={!!user} favorited={favoriteIds.has(item.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="home-cta">
        <div className="home-cta__inner">
          <h2>{content["home.cta_title"]}</h2>
          <p>{content["home.cta_description"]}</p>
          <Link href="/account/advertisements/new" className="btn-primary">
            ثبت آگهی رایگان
          </Link>
        </div>
      </section>
    </>
  );
}

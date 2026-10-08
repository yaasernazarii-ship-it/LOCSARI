import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import AdCard, { AdCardItem } from "@/components/AdCard";
import { getSiteContent } from "@/lib/siteContent";
import { toAparatEmbedUrl } from "@/lib/aparat";

export const metadata: Metadata = {
  title: "آگهی‌های ویژه (VIP) ساری",
  description: "آگهی‌های ویژهٔ املاک ساری با نمایش برجسته و اولویت در نتایج جستجو؛ خرید، فروش، رهن و اجاره.",
  alternates: { canonical: "/vip" },
};

// صفحهٔ عمومی «آگهی‌های VIP» — فقط آگهی‌های منتشرشدهٔ VIP.
export default async function VipPage() {
  const [user, content] = await Promise.all([getCurrentUser(), getSiteContent()]);
  const heroVideoUrl = content["vip.hero.aparat_url"] ? toAparatEmbedUrl(content["vip.hero.aparat_url"]) : null;

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
      "properties.area",
      "properties.bedrooms",
      "districts.name as district_name",
      "market_zones.name as market_zone_name",
      "neighborhoods.name as neighborhood_name",
      "property_media.url as primary_image",
    ])
    .where("advertisements.status", "=", "published")
    .where("advertisements.is_vip", "=", true)
    .where((eb) => eb.or([eb("advertisements.vip_expires_at", "is", null), eb("advertisements.vip_expires_at", ">", new Date())]))
    .where("properties.is_active", "=", true)
    .orderBy("advertisements.vip_expires_at", "desc")
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
    isVip: true,
  }));

  return (
    <>
      <section className="home-hero" style={content["vip.hero.image"] ? { backgroundImage: `url("${content["vip.hero.image"]}")` } : undefined}>
        <div className="home-hero__inner">
          <h1>{content["vip.hero_title"]}</h1>
          <p>{content["vip.hero_description"]}</p>
          {heroVideoUrl && <iframe title={`${content["vip.hero_title"]} ویدیو`} src={heroVideoUrl} allowFullScreen style={{ width: "100%", aspectRatio: "16 / 9", border: 0, marginTop: 20 }} />}
          <div className="home-hero__links">
            <Link href={user ? "/account/vip" : "/login?next=/account/vip"}>تبدیل آگهی من به VIP</Link>
          </div>
        </div>
      </section>

      <section className="home-section">
        {items.length > 0 ? (
          <div className="result-grid">
            {items.map((item) => (
              <AdCard key={item.id} item={item} isLoggedIn={!!user} favorited={favoriteIds.has(item.id)} />
            ))}
          </div>
        ) : (
          <p className="search-empty">{content["vip.empty_message"]}</p>
        )}
      </section>
    </>
  );
}

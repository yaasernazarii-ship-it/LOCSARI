import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import AdCard, { AdCardItem } from "@/components/AdCard";

// صفحهٔ علاقه‌مندی‌های کاربر — همان کوئری‌ای که GET /api/favorites اجرا می‌کند، مستقیماً برای رندر سمت سرور.
export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/favorites");

  const rows = await db
    .selectFrom("favorites")
    .innerJoin("advertisements", "advertisements.id", "favorites.advertisement_id")
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
    .where("favorites.user_id", "=", user.id)
    .orderBy("favorites.created_at", "desc")
    .execute();

  const items: AdCardItem[] = rows.map((r) => ({
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
      <div className="account-page-header">
        <h1>علاقه‌مندی‌های من</h1>
      </div>
      <div className="account-form">
        {items.length === 0 ? (
          <p className="search-empty">هنوز آگهی‌ای به علاقه‌مندی‌ها اضافه نکرده‌اید.</p>
        ) : (
          <div className="result-grid">
            {items.map((item) => (
              <AdCard key={item.id} item={item} isLoggedIn={true} favorited={true} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseId } from "@/lib/validation";

// Favorite روی Advertisement است نه Property (بخش ۱۸ پرامپت فاز ۳): کاربر همان آگهی
// منتشرشده با همان قیمت/شرایط را که دیده ذخیره می‌کند؛ فقط برای کاربر واردشده، بدون permission خاص.

// GET /api/favorites — لیست علاقه‌مندی‌های کاربر جاری، با اطلاعات کافی برای نمایش کارتی (بخش «Favorites» فاز ۵)
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const rows = await db
    .selectFrom("favorites")
    .innerJoin("advertisements", "advertisements.id", "favorites.advertisement_id")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("categories", "categories.id", "properties.category_id")
    .leftJoin("districts", "districts.id", "properties.district_id")
    .leftJoin("market_zones", "market_zones.id", "properties.market_zone_id")
    .leftJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .select([
      "favorites.id",
      "favorites.advertisement_id",
      "favorites.created_at",
      "advertisements.slug",
      "advertisements.title",
      "advertisements.status",
      "advertisements.transaction_type",
      "advertisements.price",
      "advertisements.deposit",
      "advertisements.monthly_rent",
      "advertisements.expires_at",
      "properties.area",
      "properties.bedrooms",
      "categories.name as category_name",
      "categories.slug as category_slug",
      "districts.name as district_name",
      "market_zones.name as market_zone_name",
      "neighborhoods.name as neighborhood_name",
      "property_media.url as primary_image",
    ])
    .where("favorites.user_id", "=", auth.user.id)
    .orderBy("favorites.created_at", "desc")
    .execute();

  const favorites = rows.map((r) => ({
    id: r.id,
    advertisementId: r.advertisement_id,
    createdAt: r.created_at,
    slug: r.slug,
    title: r.title,
    status: r.status,
    expired: r.status === "published" && r.expires_at !== null && new Date(r.expires_at) < new Date(),
    transactionType: r.transaction_type,
    price: r.price !== null ? Number(r.price) : null,
    deposit: r.deposit !== null ? Number(r.deposit) : null,
    monthlyRent: r.monthly_rent !== null ? Number(r.monthly_rent) : null,
    area: r.area !== null ? Number(r.area) : null,
    bedrooms: r.bedrooms,
    category: { name: r.category_name, slug: r.category_slug },
    location: {
      district: r.district_name ?? null,
      marketZone: r.market_zone_name ?? null,
      neighborhood: r.neighborhood_name ?? null,
    },
    primaryImage: r.primary_image ?? null,
  }));

  return NextResponse.json({ favorites });
}

// POST /api/favorites { advertisementId } — افزودن یک آگهی منتشرشده به علاقه‌مندی‌ها
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`favorite-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const advertisementId = parseId(String(body?.advertisementId ?? ""));
  if (!advertisementId) return NextResponse.json({ error: "advertisementId نامعتبر است" }, { status: 400 });

  const ad = await db
    .selectFrom("advertisements")
    .select(["id", "status"])
    .where("id", "=", advertisementId)
    .executeTakeFirst();
  if (!ad || ad.status !== "published") return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const favorite = await db
    .insertInto("favorites")
    .values({ user_id: auth.user.id, advertisement_id: advertisementId })
    .onConflict((oc) => oc.columns(["user_id", "advertisement_id"]).doNothing())
    .returningAll()
    .executeTakeFirst();

  if (!favorite) {
    const existing = await db
      .selectFrom("favorites")
      .selectAll()
      .where("user_id", "=", auth.user.id)
      .where("advertisement_id", "=", advertisementId)
      .executeTakeFirstOrThrow();
    return NextResponse.json({ favorite: existing });
  }

  return NextResponse.json({ favorite }, { status: 201 });
}

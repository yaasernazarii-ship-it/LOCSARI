import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";

// نقشهٔ سایت باید همیشه با دامنهٔ عمومی منتشر شود. هنگام build، متغیر SITE_URL ممکن است تنظیم نباشد،
// پس آدرس پایه در زمان درخواست از هدر Host خوانده می‌شود و SITE_URL فقط به‌عنوان fallback می‌ماند.
export const dynamic = "force-dynamic";

const FALLBACK_URL = process.env.SITE_URL || "https://locationsari.ir";

function resolveSiteUrl(): string {
  const host = headers().get("host");
  if (!host) return FALLBACK_URL;
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();

  const [ads, agencies, consultants, contentPages] = await Promise.all([
    db
      .selectFrom("advertisements")
      .select(["slug", "published_at"])
      .where("status", "=", "published")
      .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())]))
      .execute(),
    db
      .selectFrom("agencies")
      .select(["slug", "updated_at"])
      .where("verification_status", "=", "approved")
      .where("is_active", "=", true)
      .execute(),
    db
      .selectFrom("consultants")
      .select(["slug", "updated_at"])
      .where("verification_status", "=", "approved")
      .where("is_active", "=", true)
      .execute(),
    db
      .selectFrom("site_pages")
      .select(["slug", "updated_at"])
      .where("is_published", "=", true)
      .orderBy("sort_order", "asc")
      .orderBy("id", "asc")
      .execute(),
  ]);

  return [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/amlak`, changeFrequency: "hourly", priority: 0.9 },
    ...ads.map((a) => ({
      url: `${siteUrl}/agahi/${a.slug}`,
      lastModified: a.published_at ? new Date(a.published_at) : undefined,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...agencies.map((a) => ({
      url: `${siteUrl}/agency/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...consultants.map((c) => ({
      url: `${siteUrl}/moshaver/${c.slug}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...contentPages.map((p) => ({
      url: `${siteUrl}/p/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}

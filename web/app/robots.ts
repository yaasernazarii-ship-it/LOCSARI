import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// robots.txt — صفحات عمومی مجاز، پنل‌ها و APIها مسدود. نقشهٔ سایت هم معرفی می‌شود.
export const dynamic = "force-dynamic";

const FALLBACK_URL = process.env.SITE_URL || "https://locationsari.ir";

function resolveSiteUrl(): string {
  const host = headers().get("host");
  if (!host) return FALLBACK_URL;
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin-login", "/account", "/api/", "/uploads/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PwaRegister from "@/components/PwaRegister";

const SITE_URL = process.env.SITE_URL || "https://locationsari.ir";
const DESCRIPTION = "لوکیشن ساری؛ مرجع تخصصی خرید، فروش، رهن و اجاره ملک در ساری با آگهی‌های معتبر، تصاویر کامل و اطلاعات دقیق املاک.";

function getSiteUrl(host?: string): string {
  return host === "locationsari.com" || host === "www.locationsari.com"
    ? "https://locationsari.com"
    : host === "locationsari.ir" || host === "www.locationsari.ir"
      ? "https://locationsari.ir"
      : SITE_URL;
}

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0];
  const siteUrl = getSiteUrl(host);

  return {
    metadataBase: new URL(siteUrl),
  title: { default: "لوکیشن ساری | خرید و فروش و اجاره ملک در ساری", template: "%s | لوکیشن ساری" },
    description: DESCRIPTION,
  keywords: ["املاک ساری", "خرید خانه ساری", "فروش ملک ساری", "رهن و اجاره ساری", "آپارتمان ساری", "مشاور املاک ساری"],
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "لوکیشن ساری",
    title: "لوکیشن ساری | املاک شهر ساری",
    description: "آگهی خرید، فروش، رهن و اجاره ملک در ساری",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "لوکیشن ساری",
  },
  icons: {
    icon: [
      { url: "/favicon-32-v2.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16-v2.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon-v2.ico"],
  },
    alternates: {
      canonical: siteUrl,
      languages: {
        fa: siteUrl,
        "fa-IR": "https://locationsari.ir",
        "x-default": "https://locationsari.com",
      },
    },
  };
}
export const viewport: Viewport = {
  themeColor: "#0145c9",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0];
  const siteUrl = getSiteUrl(host);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "لوکیشن ساری",
        url: siteUrl,
        logo: `${siteUrl}/icon-192-v2.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: "لوکیشن ساری",
        inLanguage: "fa-IR",
        publisher: { "@id": `${siteUrl}#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/amlak?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="fa" dir="rtl">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <link rel="alternate" hrefLang="fa" href={siteUrl} />
        <link rel="alternate" hrefLang="fa-IR" href="https://locationsari.ir" />
        <link rel="alternate" hrefLang="x-default" href="https://locationsari.com" />
        <meta name="enamad" content="55172089" />
        <meta name="google-site-verification" content="OZMTdnHyytnPIJrOV0HZCALmRyRWS3nOYcYRZpApseI" />
      </head>
      <body>
        <PwaRegister />
        <Header />
        <main className="site-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

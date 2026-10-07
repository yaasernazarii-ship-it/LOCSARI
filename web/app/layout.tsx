import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PwaRegister from "@/components/PwaRegister";

const SITE_URL = process.env.SITE_URL || "https://locationsari.ir";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "لوکیشن ساری | خرید و فروش و اجاره ملک در ساری", template: "%s | لوکیشن ساری" },
  description: "پلتفرم تخصصی املاک شهر ساری؛ آگهی خرید، فروش، رهن و اجاره خانه، آپارتمان، زمین و مغازه در ساری با تصاویر و مشخصات کامل.",
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
};

export const viewport: Viewport = {
  themeColor: "#0145c9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
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

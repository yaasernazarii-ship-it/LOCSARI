import type { Metadata } from "next";
import { ReactNode } from "react";

// صفحهٔ جستجوی املاک یک کامپوننت کلاینت است و نمی‌تواند خودش metadata صادر کند؛
// این layout متادیتای سئوی آن را تأمین می‌کند.
export const metadata: Metadata = {
  title: "جستجوی املاک ساری",
  description: "جستجوی پیشرفتهٔ آگهی‌های خرید، فروش، رهن و اجاره ملک در ساری بر اساس منطقه، متراژ، قیمت و تعداد اتاق.",
  alternates: { canonical: "/amlak" },
};

export default function AmlakLayout({ children }: { children: ReactNode }) {
  return children;
}

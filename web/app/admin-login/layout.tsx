import type { Metadata } from "next";
import { ReactNode } from "react";

// صفحهٔ ورود مدیریت یک کامپوننت کلاینت است و نمی‌تواند خودش metadata صادر کند؛
// این layout آن را از ایندکس موتورهای جستجو خارج می‌کند.
export const metadata: Metadata = {
  title: "ورود به پنل مدیریت",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children;
}

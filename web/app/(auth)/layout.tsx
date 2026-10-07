import type { Metadata } from "next";
import { ReactNode } from "react";

// صفحات ورود/ثبت‌نام/بازیابی رمز نباید در نتایج گوگل ایندکس شوند.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}

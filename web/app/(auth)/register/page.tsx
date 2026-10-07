import { redirect } from "next/navigation";

// ثبت‌نام کاربر عادی دیگر مسیر جدا ندارد؛ همه‌چیز (ورود + ثبت‌نام خودکار) از طریق پیامک در /login انجام می‌شود.
export default function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams?.next;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}

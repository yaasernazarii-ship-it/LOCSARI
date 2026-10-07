import { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import type { DashboardNavItem } from "@/components/DashboardSidebarNav";
import DashboardShell from "@/components/DashboardShell";

// پنل کاربری نباید در نتایج گوگل ایندکس شود.
export const metadata: Metadata = {
  title: "حساب کاربری",
  robots: { index: false, follow: false },
};

// پوستهٔ حساب کاربری/آژانس/مشاور — همان DashboardShell مشترک با پنل مدیریت.
// این یعنی ساختار و ظاهر با پنل مدیریت یکسان است و هر پنل کدنویسی مجزا برای پوستهٔ خودش ندارد.

const NAV_ITEMS: DashboardNavItem[] = [
  { href: "/account", label: "داشبورد", icon: "LayoutDashboard", exactMatch: true },
  { href: "/account/advertisements", label: "آگهی‌های من", icon: "Megaphone" },
  { href: "/account/advertisements/new", label: "ثبت آگهی جدید", icon: "PlusCircle" },
  { href: "/account/favorites", label: "علاقه‌مندی‌ها", icon: "Heart" },
  { href: "/account/requests", label: "درخواست‌های من", icon: "Inbox" },
  { href: "/account/messages", label: "گفتگوهای من", icon: "MessageCircle" },
  { href: "/account/vip", label: "آگهی VIP", icon: "Crown" },
  { href: "/account/cip", label: "ویدیوی CIP", icon: "FileText" },
  { href: "/account/consultant", label: "پروفایل مشاور", icon: "UserCheck" },
  { href: "/account/agency", label: "آژانس من", icon: "Building2" },
];

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const canAccessAdmin = await userHasPermission(user.id, "admin.dashboard.view");
  const navItems = canAccessAdmin
    ? [...NAV_ITEMS, { href: "/admin", label: "پنل مدیریت", icon: "Settings" as const }]
    : NAV_ITEMS;

  return (
    <DashboardShell
      brandTitle="لوکیشن ساری"
      brandSubtitle="حساب کاربری"
      brandIcon={LayoutDashboard}
      navItems={navItems}
      topbarTitle="حساب کاربری"
      userName={user.name}
      userMeta={user.phone}
    >
      {children}
    </DashboardShell>
  );
}

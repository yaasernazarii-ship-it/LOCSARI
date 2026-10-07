import { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserRoleKeys, userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminToastHost from "@/components/AdminToastHost";
import AdminAutoRefresh from "@/components/AdminAutoRefresh";
import DashboardShell from "@/components/DashboardShell";
import type { DashboardIconName } from "@/components/DashboardSidebarNav";

// پنل مدیریت نباید در نتایج گوگل ایندکس شود.
export const metadata: Metadata = {
  title: "پنل مدیریت",
  robots: { index: false, follow: false },
};

// پوستهٔ داشبورد مدیریت (فاز ۷.۱) — دروازهٔ ورود admin.dashboard.view + منوی کناری مبتنی بر Permission.
// هیچ معماری Auth/RBAC جدیدی اضافه نمی‌شود؛ فقط از userHasPermission موجود استفاده می‌شود.
// پوستهٔ بصری (سایدبار/بالانوار) از DashboardShell مشترک با پنل حساب کاربری استفاده می‌کند.

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: DashboardIconName;
  permission: string;
  badge?: "ads" | "agencies" | "consultants" | "chats";
}[] = [
  { href: "/admin", label: "داشبورد", icon: "LayoutDashboard", permission: "admin.dashboard.view" },
  { href: "/admin/advertisements", label: "آگهی‌ها", icon: "Megaphone", permission: "advertisement.approve", badge: "ads" },
  { href: "/admin/users", label: "کاربران", icon: "Users", permission: "user.manage" },
  { href: "/admin/agencies", label: "آژانس‌ها", icon: "Building2", permission: "agency.approve", badge: "agencies" },
  { href: "/admin/consultants", label: "مشاوران", icon: "UserCheck", permission: "consultant.approve", badge: "consultants" },
  { href: "/admin/vip-plans", label: "اشتراک VIP", icon: "Crown", permission: "vip.manage" },
  { href: "/admin/cip", label: "CIP", icon: "FileText", permission: "cip.manage" },
  { href: "/admin/chats", label: "گفتگوهای آگهی‌ها", icon: "MessageCircle", permission: "chat.view" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "Tags", permission: "category.view" },
  { href: "/admin/locations", label: "موقعیت‌های جغرافیایی", icon: "MapPin", permission: "location.view" },
  { href: "/admin/content", label: "محتوا", icon: "FileText", permission: "content.view" },
  { href: "/admin/reports", label: "گزارش‌ها", icon: "BarChart3", permission: "admin.dashboard.view" },
  { href: "/admin/settings", label: "تنظیمات", icon: "Settings", permission: "admin.dashboard.view" },
];

async function countPending(
  table: "advertisements" | "agencies" | "consultants",
  col: string,
  val: string
): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where(col as never, "=", val as never)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");

  const allowed = await userHasPermission(user.id, "admin.dashboard.view");
  if (!allowed) {
    const roles = await getUserRoleKeys(user.id);
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>
          حساب کاربری «{user.name}» مجوز دسترسی به داشبورد مدیریت را ندارد.
        </p>
        <p style={{ color: "#888", fontSize: "0.85rem" }}>نقش‌های فعلی: {roles.join("، ") || "بدون نقش"}</p>
      </div>
    );
  }

  const roles = await getUserRoleKeys(user.id);
  const permissionChecks = await Promise.all(NAV_ITEMS.map((item) => userHasPermission(user.id, item.permission)));
  const visibleItems = NAV_ITEMS.filter((_, i) => permissionChecks[i]);

  const needsBadge = (key: string) => visibleItems.some((i) => i.badge === key);
  const [adsBadge, agenciesBadge, consultantsBadge] = await Promise.all([
    needsBadge("ads") ? countPending("advertisements", "status", "pending_review") : Promise.resolve(0),
    needsBadge("agencies") ? countPending("agencies", "verification_status", "pending") : Promise.resolve(0),
    needsBadge("consultants") ? countPending("consultants", "verification_status", "pending") : Promise.resolve(0),
  ]);
  const badgeCounts: Record<string, number> = {
    ads: adsBadge,
    agencies: agenciesBadge,
    consultants: consultantsBadge,
  };

  return (
    <>
      <DashboardShell
        brandTitle="لوکیشن ساری"
        brandSubtitle="پنل مدیریت"
        brandIcon={LayoutDashboard}
        navItems={visibleItems}
        badgeCounts={badgeCounts}
        topbarTitle="پنل مدیریت لوکیشن ساری"
        userName={user.name}
        userMeta={roles.join("، ") || "بدون نقش"}
      >
        {children}
      </DashboardShell>
      <AdminToastHost />
      <AdminAutoRefresh />
    </>
  );
}

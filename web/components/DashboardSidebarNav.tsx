"use client";

// منوی کنارهٔ داشبورد — مشترک بین پنل مدیریت و پنل حساب کاربری/آژانس/مشاور.
// هایلایت خودکار آیتم فعال بر اساس مسیر جاری؛ آیکون هر آیتم با یک نام رشته‌ای (نه ارجاع تابع)
// از بیرون داده می‌شود، چون ارسال کامپوننت به‌عنوان prop از Server Component به Client Component
// در RSC مجاز نیست (خطای «Functions cannot be passed directly to Client Components»).

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Building2,
  UserCheck,
  Crown,
  MessageCircle,
  Tags,
  MapPin,
  FileText,
  BarChart3,
  Settings,
  PlusCircle,
  Heart,
  Inbox,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  LayoutDashboard,
  Megaphone,
  Users,
  Building2,
  UserCheck,
  Crown,
  MessageCircle,
  Tags,
  MapPin,
  FileText,
  BarChart3,
  Settings,
  PlusCircle,
  Heart,
  Inbox,
} satisfies Record<string, LucideIcon>;

export type DashboardIconName = keyof typeof ICONS;

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: DashboardIconName;
  badge?: string;
  exactMatch?: boolean;
};

export default function DashboardSidebarNav({
  items,
  badgeCounts = {},
  onNavigate,
}: {
  items: DashboardNavItem[];
  badgeCounts?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  function handleClick() {
    const toggle = document.getElementById("dashboard-sidebar-toggle") as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
    onNavigate?.();
  }

  return (
    <nav className="dashboard-nav">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const count = item.badge ? badgeCounts[item.badge] ?? 0 : 0;
        const isActive = item.exactMatch ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={isActive ? "dashboard-nav-active" : undefined} onClick={handleClick}>
            <span className="dashboard-nav-link__label">
              <Icon size={18} />
              <span>{item.label}</span>
            </span>
            {count > 0 && <span className="dashboard-nav-badge">{count.toLocaleString("fa-IR")}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

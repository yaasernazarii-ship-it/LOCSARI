import { ReactNode } from "react";
import Link from "next/link";
import { Menu, type LucideIcon } from "lucide-react";
import DashboardSidebarNav, { DashboardNavItem } from "./DashboardSidebarNav";
import LogoutButton from "./LogoutButton";

// پوستهٔ مشترک داشبورد — یک‌بار پیاده‌سازی، مصرف در پنل مدیریت و پنل حساب کاربری/آژانس/مشاور.
// هر تغییری در ظاهر یا رفتار پوسته (سایدبار/بالانوار) اینجا انجام می‌شود و در همهٔ پنل‌ها یکسان اعمال می‌شود.

function initialsOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0] : "?";
}

export default function DashboardShell({
  brandTitle,
  brandSubtitle,
  brandIcon: BrandIcon = Menu,
  navItems,
  badgeCounts = {},
  topbarTitle,
  userName,
  userMeta,
  children,
}: {
  brandTitle: string;
  brandSubtitle: string;
  brandIcon?: LucideIcon;
  navItems: DashboardNavItem[];
  badgeCounts?: Record<string, number>;
  topbarTitle: string;
  userName: string;
  userMeta?: string;
  children: ReactNode;
}) {
  return (
    <>
      <input type="checkbox" id="dashboard-sidebar-toggle" className="dashboard-sidebar-toggle" />
      <div className="dashboard-shell">
        <label htmlFor="dashboard-sidebar-toggle" className="dashboard-backdrop" aria-hidden="true" />
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar__brand">
            <span className="dashboard-sidebar__brand-icon">
              <BrandIcon size={18} />
            </span>
            <span className="dashboard-sidebar__brand-text">
              <strong>{brandTitle}</strong>
              <span>{brandSubtitle}</span>
            </span>
          </div>
          <DashboardSidebarNav items={navItems} badgeCounts={badgeCounts} />
        </aside>
        <div className="dashboard-main">
          <header className="dashboard-topbar">
            <label htmlFor="dashboard-sidebar-toggle" className="dashboard-menu-btn" aria-label="باز کردن منو">
              <Menu size={20} />
            </label>
            <span className="dashboard-topbar__title">{topbarTitle}</span>
            <div className="dashboard-topbar__user">
              <Link href="/" className="dashboard-topbar__home-link">
                بازگشت به سایت
              </Link>
              <div className="dashboard-topbar__user-info">
                <span className="dashboard-avatar">{initialsOf(userName)}</span>
                <span className="dashboard-topbar__user-meta">
                  <strong>{userName}</strong>
                  {userMeta && <span>{userMeta}</span>}
                </span>
              </div>
              <LogoutButton className="dashboard-logout" />
            </div>
          </header>
          <main className="dashboard-content">{children}</main>
        </div>
      </div>
    </>
  );
}

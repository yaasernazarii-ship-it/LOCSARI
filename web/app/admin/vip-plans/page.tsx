import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatToman } from "@/lib/labels";
import AdminVipPlanToggle from "@/components/AdminVipPlanToggle";

// لیست پلن‌های اشتراک آگهی VIP — مدیریت پلن‌ها + لینک به صف تأیید درخواست‌های خرید.
export default async function AdminVipPlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "vip.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مدیریت پلن‌های VIP را ندارید.</p>
      </div>
    );
  }

  const plans = await db.selectFrom("vip_plans").selectAll().orderBy("sort_order", "asc").execute();

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>اشتراک VIP</h1>
          <p>{plans.length.toLocaleString("fa-IR")} پلن — مدیریت پلن‌های اشتراک آگهی VIP.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/vip-plans/subscriptions" className="btn-secondary admin-header-btn">
            اشتراک‌های خریداری‌شده
          </Link>
          <Link href="/admin/vip-plans/ads" className="btn-secondary admin-header-btn">
            آگهی‌های VIP
          </Link>
          <Link href="/admin/vip-plans/new" className="btn-primary admin-header-btn">
            + پلن جدید
          </Link>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>عنوان</th>
              <th>سقف آگهی</th>
              <th>قیمت</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/vip-plans/${p.id}`}>{p.title}</Link>
                </td>
                <td>{p.ad_limit.toLocaleString("fa-IR")}</td>
                <td>{formatToman(Number(p.price))}</td>
                <td>
                  <span className={`status-badge status-badge--${p.is_active ? "approved" : "suspended"}`}>
                    {p.is_active ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Link href={`/admin/vip-plans/${p.id}`}>ویرایش</Link>
                  <AdminVipPlanToggle planId={p.id} isActive={p.is_active} />
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} className="search-empty">
                  پلنی ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatToman } from "@/lib/labels";

export default async function AdminCipPlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "cip.manage"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز مدیریت CIP را ندارید.</p></div>;
  }

  const plans = await db.selectFrom("cip_plans").selectAll().orderBy("sort_order", "asc").execute();

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>پلن‌های CIP</h1>
          <p>{plans.length.toLocaleString("fa-IR")} پلن — مدیریت پلن‌های تولید ویدیوی CIP.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/cip" className="btn-secondary admin-header-btn">بازگشت به CIP</Link>
          <Link href="/admin/cip/plans/new" className="btn-primary admin-header-btn">+ پلن جدید</Link>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>عنوان</th>
              <th>قیمت</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td><Link href={`/admin/cip/plans/${plan.id}`}>{plan.title}</Link></td>
                <td>{formatToman(Number(plan.price))}</td>
                <td>
                  <span className={`status-badge status-badge--${plan.is_active ? "approved" : "suspended"}`}>
                    {plan.is_active ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td><Link href={`/admin/cip/plans/${plan.id}`}>ویرایش</Link></td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={4} className="search-empty">پلنی ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

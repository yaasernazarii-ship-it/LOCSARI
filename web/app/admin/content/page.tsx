import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminContentRowActions from "@/components/AdminContentRowActions";

export default async function AdminContentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "content.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ بخش محتوا را ندارید.</p>
      </div>
    );
  }

  const [canCreate, canEdit, canDelete, pages] = await Promise.all([
    userHasPermission(user.id, "content.create"),
    userHasPermission(user.id, "content.edit"),
    userHasPermission(user.id, "content.delete"),
    db.selectFrom("site_pages").selectAll().orderBy("sort_order", "asc").orderBy("id", "asc").execute(),
  ]);

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>محتوا</h1>
          <p>مدیریت صفحات ثابت و متن‌های اجزای عمومی سایت بدون نیاز به کدنویسی.</p>
        </div>
        <div className="admin-header-actions">
          {canEdit && <Link href="/admin/content/site" className="btn-secondary admin-header-btn">ویرایش اجزای سایت</Link>}
          {canCreate && (
            <Link href="/admin/content/new" className="btn-primary admin-header-btn">
              + صفحهٔ جدید
            </Link>
          )}
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>عنوان</th>
              <th>آدرس</th>
              <th>وضعیت</th>
              <th>ترتیب</th>
              <th>آخرین به‌روزرسانی</th>
              {(canEdit || canDelete) && <th>عملیات</th>}
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td dir="ltr" style={{ textAlign: "left" }}>
                  /p/{p.slug}
                </td>
                <td>
                  <span className={`status-badge status-badge--${p.is_published ? "approved" : "draft"}`}>
                    {p.is_published ? "منتشرشده" : "پیش‌نویس"}
                  </span>
                </td>
                <td>{p.sort_order.toLocaleString("fa-IR")}</td>
                <td>{new Date(p.updated_at).toLocaleString("fa-IR")}</td>
                {(canEdit || canDelete) && (
                  <td>
                    <AdminContentRowActions pageId={p.id} canEdit={canEdit} canDelete={canDelete} />
                  </td>
                )}
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={canEdit || canDelete ? 6 : 5} className="search-empty">
                  هنوز صفحه‌ای ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

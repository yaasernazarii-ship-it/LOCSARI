import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminContentManager from "@/components/AdminContentManager";

export default async function AdminContentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "content.view"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز مشاهدهٔ بخش محتوا را ندارید.</p></div>;
  }

  const [canCreate, canEdit, canDelete, pages] = await Promise.all([
    userHasPermission(user.id, "content.create"),
    userHasPermission(user.id, "content.edit"),
    userHasPermission(user.id, "content.delete"),
    db.selectFrom("site_pages").selectAll().orderBy("sort_order", "asc").orderBy("id", "asc").execute(),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>محتوا</h1>
        <p>مدیریت صفحات سایت و متن‌ها و بنرهای صفحهٔ اصلی در یکجا.</p>
      </div>
      <AdminContentManager pages={pages} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
    </>
  );
}

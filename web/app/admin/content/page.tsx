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

  const systemPages = [
    { id: -1, title: "صفحهٔ اصلی", slug: "", is_published: true, sort_order: -4, updated_at: new Date(), system: true, contentPath: "/admin/content/site/home", publicPath: "/" },
    { id: -2, title: "آگهی‌های VIP", slug: "vip", is_published: true, sort_order: -3, updated_at: new Date(), system: true, contentPath: "/admin/content/site/vip", publicPath: "/vip" },
    { id: -3, title: "آگهی‌های CIP", slug: "cip", is_published: true, sort_order: -2, updated_at: new Date(), system: true, contentPath: "/admin/content/site/cip", publicPath: "/cip" },
    { id: -4, title: "تماس با ما", slug: "contact", is_published: true, sort_order: -1, updated_at: new Date(), system: true, contentPath: "/admin/content/site/contact", publicPath: "/contact" },
  ];
  const allPages = [...systemPages, ...pages];

  return (
    <>
      <div className="admin-page-header">
        <h1>محتوا</h1>
        <p>مدیریت صفحات سایت و متن‌ها و بنرهای صفحهٔ اصلی در یکجا.</p>
      </div>
      <AdminContentManager pages={allPages} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
    </>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminCategoryForm from "@/components/AdminCategoryForm";

export default async function AdminCategoryNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "category.create");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ایجاد دسته‌بندی جدید را ندارید.</p>
      </div>
    );
  }

  const categories = await db.selectFrom("categories").select(["id", "name", "parent_id"]).orderBy("sort_order", "asc").execute();

  return (
    <>
      <div className="admin-page-header">
        <h1>دسته‌بندی جدید</h1>
      </div>
      <AdminCategoryForm mode="create" categories={categories} />
    </>
  );
}

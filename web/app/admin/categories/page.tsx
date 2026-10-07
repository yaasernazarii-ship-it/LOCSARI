import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminCategoryToggle from "@/components/AdminCategoryToggle";

type CategoryRow = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

function buildTree(categories: CategoryRow[]): Map<number | null, CategoryRow[]> {
  const map = new Map<number | null, CategoryRow[]>();
  for (const c of categories) {
    const list = map.get(c.parent_id) ?? [];
    list.push(c);
    map.set(c.parent_id, list);
  }
  return map;
}

export default async function AdminCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "category.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ دسته‌بندی‌ها را ندارید.</p>
      </div>
    );
  }

  const [canCreate, canEdit] = await Promise.all([
    userHasPermission(user.id, "category.create"),
    userHasPermission(user.id, "category.edit"),
  ]);

  const categories = await db
    .selectFrom("categories")
    .select(["id", "parent_id", "name", "slug", "sort_order", "is_active"])
    .orderBy("sort_order", "asc")
    .execute();

  const byParent = buildTree(categories);

  function renderLevel(parentId: number | null, depth: number): JSX.Element[] {
    const items = byParent.get(parentId) ?? [];
    return items.flatMap((c) => [
      <tr key={c.id}>
        <td style={{ paddingRight: depth * 24 }}>{"— ".repeat(depth)}{c.name}</td>
        <td dir="ltr" style={{ textAlign: "left" }}>{c.slug}</td>
        <td>
          <span className={`status-badge status-badge--${c.is_active ? "approved" : "suspended"}`}>
            {c.is_active ? "فعال" : "غیرفعال"}
          </span>
        </td>
        <td style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href={`/admin/categories/${c.id}`}>مدیریت</Link>
          {canEdit && <AdminCategoryToggle categoryId={c.id} isActive={c.is_active} />}
        </td>
      </tr>,
      ...renderLevel(c.id, depth + 1),
    ]);
  }

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>دسته‌بندی‌ها</h1>
          <p>{categories.length.toLocaleString("fa-IR")} دسته‌بندی — مدیریت دسته‌بندی‌ها و فیلدهای اختصاصی هر دسته بدون نیاز به کدنویسی.</p>
        </div>
        {canCreate && (
          <Link href="/admin/categories/new" className="btn-primary admin-header-btn">
            + دسته‌بندی جدید
          </Link>
        )}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>Slug</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {renderLevel(null, 0)}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="search-empty">
                  دسته‌بندی‌ای ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

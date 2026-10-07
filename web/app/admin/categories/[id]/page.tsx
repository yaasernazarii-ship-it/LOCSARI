import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import AdminCategoryForm from "@/components/AdminCategoryForm";
import AdminCategoryFieldManager from "@/components/AdminCategoryFieldManager";

export default async function AdminCategoryManagePage({ params }: { params: { id: string } }) {
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

  const id = parseId(params.id);
  if (!id) notFound();

  const category = await db.selectFrom("categories").select(["id", "name"]).where("id", "=", id).executeTakeFirst();
  if (!category) notFound();

  const [canEdit, canDelete, canViewFields, canCreateField, canEditField, canDeleteField, categories] = await Promise.all([
    userHasPermission(user.id, "category.edit"),
    userHasPermission(user.id, "category.delete"),
    userHasPermission(user.id, "category.field.view"),
    userHasPermission(user.id, "category.field.create"),
    userHasPermission(user.id, "category.field.edit"),
    userHasPermission(user.id, "category.field.delete"),
    db.selectFrom("categories").select(["id", "name", "parent_id"]).orderBy("sort_order", "asc").execute(),
  ]);

  let fieldsWithOptions: {
    id: number;
    key: string;
    label_fa: string;
    field_type: string;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
    options: { id: number; value: string; label_fa: string; sort_order: number; is_active: boolean }[];
  }[] = [];

  if (canViewFields) {
    const [fields, allOptions] = await Promise.all([
      db
        .selectFrom("category_fields")
        .select(["id", "key", "label_fa", "field_type", "is_required", "sort_order", "is_active"])
        .where("category_id", "=", id)
        .orderBy("sort_order", "asc")
        .execute(),
      db
        .selectFrom("category_field_options")
        .innerJoin("category_fields", "category_fields.id", "category_field_options.field_id")
        .select([
          "category_field_options.id",
          "category_field_options.field_id",
          "category_field_options.value",
          "category_field_options.label_fa",
          "category_field_options.sort_order",
          "category_field_options.is_active",
        ])
        .where("category_fields.category_id", "=", id)
        .orderBy("category_field_options.sort_order", "asc")
        .execute(),
    ]);

    const optionsByField = new Map<number, typeof allOptions>();
    for (const o of allOptions) {
      optionsByField.set(o.field_id, [...(optionsByField.get(o.field_id) ?? []), o]);
    }

    fieldsWithOptions = fields.map((f) => ({ ...f, options: optionsByField.get(f.id) ?? [] }));
  }

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}>
          <Link href="/admin/categories">← بازگشت به دسته‌بندی‌ها</Link>
        </p>
        <h1>{category.name}</h1>
      </div>

      <AdminCategoryForm mode="edit" categoryId={id} categories={categories} canEdit={canEdit} canDelete={canDelete} />

      {canViewFields ? (
        <AdminCategoryFieldManager
          categoryId={id}
          fields={fieldsWithOptions}
          canCreate={canCreateField}
          canEdit={canEditField}
          canDelete={canDeleteField}
        />
      ) : (
        <div className="form-section">
          <p className="search-empty">مجوز مشاهدهٔ فیلدهای اختصاصی این دسته‌بندی را ندارید.</p>
        </div>
      )}
    </>
  );
}

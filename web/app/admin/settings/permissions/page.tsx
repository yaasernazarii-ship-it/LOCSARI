import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission, getUserRoleKeys } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminPermissionMatrix from "@/components/AdminPermissionMatrix";

export default async function AdminPermissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "user.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ تنظیمات دسترسی‌ها را ندارید.</p>
      </div>
    );
  }

  const [roles, permissions, rolePermissions, userPermissionOverrides, actorRoleKeys] = await Promise.all([
    db.selectFrom("roles").select(["id", "key", "title_fa"]).orderBy("id", "asc").execute(),
    db.selectFrom("permissions").select(["id", "key", "description_fa"]).orderBy("key", "asc").execute(),
    db.selectFrom("role_permissions").select(["role_id", "permission_id"]).execute(),
    db
      .selectFrom("user_permissions")
      .innerJoin("users", "users.id", "user_permissions.user_id")
      .innerJoin("permissions", "permissions.id", "user_permissions.permission_id")
      .select(["users.id as user_id", "users.name as user_name", "permissions.key as permission_key", "user_permissions.effect"])
      .orderBy("users.name", "asc")
      .execute(),
    getUserRoleKeys(user.id),
  ]);

  const grantList = rolePermissions.map((rp) => `${rp.role_id}:${rp.permission_id}`);
  const isSuperAdmin = actorRoleKeys.includes("super_admin");

  return (
    <>
      <div className="admin-page-header">
        <h1>دسترسی‌ها (RBAC)</h1>
        <p>
          {isSuperAdmin
            ? "ماتریس نقش × مجوز قابل‌ویرایش است. نقش مدیر کل همیشه همهٔ مجوزها را دارد."
            : "نمایشِ فقط‌خواندنیِ نقش‌ها، مجوزها و override‌های کاربری — ویرایش فقط برای مدیر کل مجاز است."}
        </p>
      </div>

      <section className="form-section admin-perm-matrix">
        <h2>ماتریس نقش × مجوز</h2>
        <AdminPermissionMatrix roles={roles} permissions={permissions} grantSet={grantList} editable={isSuperAdmin} />
      </section>

      <section className="form-section">
        <h2>Override های اختصاصی کاربران (Allow / Deny)</h2>
        {userPermissionOverrides.length === 0 ? (
          <p className="search-empty">هیچ overrideـی برای هیچ کاربری ثبت نشده است.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>مجوز</th>
                  <th>اثر</th>
                </tr>
              </thead>
              <tbody>
                {userPermissionOverrides.map((o, idx) => (
                  <tr key={idx}>
                    <td>{o.user_name}</td>
                    <td>{o.permission_key}</td>
                    <td>
                      <span className={`status-badge status-badge--${o.effect === "allow" ? "approved" : "rejected"}`}>
                        {o.effect === "allow" ? "Allow" : "Deny"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission, getUserRoleKeys } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import AdminUserRoleActions from "@/components/AdminUserRoleActions";
import AdminUserPermissionOverrides from "@/components/AdminUserPermissionOverrides";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/admin-login");
  const allowed = await userHasPermission(currentUser.id, "user.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ جزئیات کاربر را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const targetUser = await db
    .selectFrom("users")
    .select(["id", "name", "phone", "status", "created_at", "updated_at"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!targetUser) notFound();

  const [roles, permissionOverrides, adCount, agency, consultant, allRoles, allPermissions, actorRoleKeys] = await Promise.all([
    db
      .selectFrom("user_roles")
      .innerJoin("roles", "roles.id", "user_roles.role_id")
      .select(["roles.id", "roles.key", "roles.title_fa"])
      .where("user_roles.user_id", "=", id)
      .execute(),
    db
      .selectFrom("user_permissions")
      .innerJoin("permissions", "permissions.id", "user_permissions.permission_id")
      .select(["permissions.key", "permissions.description_fa", "user_permissions.effect"])
      .where("user_permissions.user_id", "=", id)
      .execute(),
    db
      .selectFrom("advertisements")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("created_by_user_id", "=", id)
      .executeTakeFirst(),
    db.selectFrom("agencies").select(["id", "name", "slug", "verification_status"]).where("owner_user_id", "=", id).executeTakeFirst(),
    db
      .selectFrom("consultants")
      .select(["id", "display_name", "slug", "verification_status"])
      .where("user_id", "=", id)
      .executeTakeFirst(),
    db.selectFrom("roles").select(["id", "key", "title_fa"]).orderBy("id", "asc").execute(),
    db.selectFrom("permissions").select(["key", "description_fa"]).orderBy("key", "asc").execute(),
    getUserRoleKeys(currentUser.id),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>{targetUser.name}</h1>
        <p>شناسهٔ کاربر: {targetUser.id} · موبایل: {targetUser.phone}</p>
      </div>

      <div className="admin-actions-bar">
        <span className={`status-badge status-badge--${targetUser.status === "active" ? "approved" : "suspended"}`}>
          {targetUser.status === "active" ? "فعال" : "تعلیق‌شده"}
        </span>
      </div>

      <div className="admin-detail-grid">
        <div>
          <section className="form-section">
            <h2>اطلاعات حساب</h2>
            <div className="detail-facts">
              <div className="detail-fact">
                <span className="detail-fact__label">نام</span>
                <span className="detail-fact__value">{targetUser.name}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">موبایل</span>
                <span className="detail-fact__value">{targetUser.phone}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">تاریخ عضویت</span>
                <span className="detail-fact__value">{new Date(targetUser.created_at).toLocaleString("fa-IR")}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">آخرین به‌روزرسانی</span>
                <span className="detail-fact__value">{new Date(targetUser.updated_at).toLocaleString("fa-IR")}</span>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>نقش‌ها</h2>
            <AdminUserRoleActions
              userId={id}
              assignedRoleKeys={roles.map((r) => r.key)}
              allRoles={allRoles}
              canManageSensitive={actorRoleKeys.includes("super_admin")}
              isSelf={currentUser.id === id}
            />
          </section>

          <section className="form-section">
            <h2>مجوزهای اختصاصی (Override)</h2>
            <p style={{ color: "#888", fontSize: "0.8rem" }}>
              override روی هر کاربر، مستقل از نقش، اولویت دارد — Deny همیشه رد می‌کند حتی اگر نقش اجازه داده باشد.
            </p>
            <AdminUserPermissionOverrides
              userId={id}
              overrides={permissionOverrides.map((p) => ({ key: p.key, effect: p.effect, description_fa: p.description_fa }))}
              allPermissions={allPermissions}
            />
          </section>
        </div>

        <div>
          <section className="form-section">
            <h2>آگهی‌ها</h2>
            <p>{Number(adCount?.count ?? 0).toLocaleString("fa-IR")} آگهی ثبت‌شده توسط این کاربر</p>
            <Link href={`/admin/advertisements?owner=${encodeURIComponent(targetUser.phone)}`}>مشاهدهٔ آگهی‌های این کاربر</Link>
          </section>

          {agency && (
            <section className="form-section">
              <h2>آژانس</h2>
              <p>{agency.name}</p>
              <p style={{ color: "#666" }}>وضعیت تأیید: {agency.verification_status}</p>
              <Link href={`/admin/agencies/${agency.id}`}>مشاهدهٔ آژانس</Link>
            </section>
          )}

          {consultant && (
            <section className="form-section">
              <h2>پروفایل مشاور</h2>
              <p>{consultant.display_name}</p>
              <p style={{ color: "#666" }}>وضعیت تأیید: {consultant.verification_status}</p>
              <Link href={`/admin/consultants/${consultant.id}`}>مشاهدهٔ مشاور</Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

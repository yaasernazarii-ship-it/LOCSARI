import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission, getUserRoleKeys } from "@/lib/rbac";
import { db } from "@/lib/db";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "admin.dashboard.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ تنظیمات را ندارید.</p>
      </div>
    );
  }

  const [roleKeys, myPermissions, canManageUsers, canEditContent] = await Promise.all([
    getUserRoleKeys(user.id),
    db
      .selectFrom("user_permissions")
      .innerJoin("permissions", "permissions.id", "user_permissions.permission_id")
      .select(["permissions.key", "user_permissions.effect"])
      .where("user_permissions.user_id", "=", user.id)
      .execute(),
    userHasPermission(user.id, "user.manage"),
    userHasPermission(user.id, "content.edit"),
  ]);

  const dbStatus = await db
    .selectFrom("admin_audit_logs")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst();

  return (
    <>
      <div className="admin-page-header">
        <h1>تنظیمات</h1>
      </div>

      <div className="admin-detail-grid">
        <div>
          <section className="form-section">
            <h2>حساب فعلی</h2>
            <div className="detail-facts">
              <div className="detail-fact">
                <span className="detail-fact__label">نام</span>
                <span className="detail-fact__value">{user.name}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">موبایل</span>
                <span className="detail-fact__value">{user.phone}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">وضعیت</span>
                <span className="detail-fact__value">{user.status === "active" ? "فعال" : "تعلیق‌شده"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">تاریخ عضویت</span>
                <span className="detail-fact__value">{new Date(user.created_at).toLocaleString("fa-IR")}</span>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>نقش‌های من</h2>
            {roleKeys.length === 0 ? (
              <p className="search-empty">نقشی ندارید.</p>
            ) : (
              <ul className="admin-history-list">
                {roleKeys.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            )}
          </section>

          {myPermissions.length > 0 && (
            <section className="form-section">
              <h2>Override های اختصاصی من</h2>
              <ul className="admin-history-list">
                {myPermissions.map((p) => (
                  <li key={p.key}>
                    <span className={`status-badge status-badge--${p.effect === "allow" ? "approved" : "rejected"}`}>
                      {p.effect === "allow" ? "Allow" : "Deny"}
                    </span>{" "}
                    {p.key}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div>
          <section className="form-section">
            <h2>وضعیت سامانه</h2>
            <div className="detail-facts">
              <div className="detail-fact">
                <span className="detail-fact__label">تعداد رخدادهای Audit Log</span>
                <span className="detail-fact__value">{Number(dbStatus?.count ?? 0).toLocaleString("fa-IR")}</span>
              </div>
            </div>
            <p style={{ marginTop: 12 }}>
              <Link href="/admin/settings/audit-log">مشاهدهٔ تاریخچهٔ کامل تغییرات (پلن‌ها، اشتراک‌ها، CIP و سایر موجودیت‌ها)</Link>
            </p>
          </section>

          {canManageUsers && (
            <section className="form-section">
              <h2>مدیریت دسترسی‌ها</h2>
              <p>
                <Link href="/admin/settings/permissions">مشاهدهٔ ماتریس کامل نقش‌ها و مجوزها</Link>
              </p>
            </section>
          )}

          {canEditContent && (
            <section className="form-section">
              <h2>اطلاعات تماس سایت</h2>
              <p>
                <Link href="/admin/settings/contact">ویرایش آدرس، شماره تماس و شبکه‌های اجتماعی صفحهٔ «تماس با ما»</Link>
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

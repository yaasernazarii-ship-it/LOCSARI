import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminPropertyAssistantSettingsForm from "@/components/AdminPropertyAssistantSettingsForm";

const DEFAULT_ASSISTANT_NAME = "دستیار نیازسنجی هوشمند شما";

function dealTypeLabel(value: string | null) {
  if (value === "sale") return "خرید";
  if (value === "mortgage_rent") return "رهن و اجاره";
  return "تعیین نشده";
}

function propertyTypeLabel(value: string | null) {
  if (value === "apartment") return "آپارتمان";
  if (value === "villa") return "ویلا";
  if (value === "land") return "زمین";
  return "تعیین نشده";
}

export default async function AdminPropertyAssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "admin.dashboard.view");
  if (!allowed) redirect("/admin-login");

  const [canEdit, settings, alerts] = await Promise.all([
    userHasPermission(user.id, "content.edit"),
    db.selectFrom("property_assistant_settings").select("name").where("id", "=", 1).executeTakeFirst(),
    db
      .selectFrom("property_alerts")
      .leftJoin("neighborhoods", "neighborhoods.id", "property_alerts.neighborhood_id")
      .select([
        "property_alerts.id",
        "property_alerts.recipient_name",
        "property_alerts.phone",
        "property_alerts.query_text",
        "property_alerts.deal_type",
        "property_alerts.property_type",
        "property_alerts.is_active",
        "property_alerts.created_at",
        "neighborhoods.name as neighborhood_name",
      ])
      .orderBy("property_alerts.created_at", "desc")
      .limit(100)
      .execute(),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>دستیار نیازسنجی</h1>
      </div>
      <p className="form-hint">نام دستیار و اطلاعات ثبت‌شدهٔ متقاضیان ملک را از این بخش مدیریت کنید.</p>
      <AdminPropertyAssistantSettingsForm initialName={settings?.name ?? DEFAULT_ASSISTANT_NAME} canEdit={canEdit} />

      <section className="form-section">
        <h2>درخواست‌های ثبت‌شده</h2>
        {alerts.length === 0 ? (
          <p className="search-empty">هنوز درخواست نیازسنجی ثبت نشده است.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>متقاضی</th>
                  <th>شماره تماس</th>
                  <th>نیاز ثبت‌شده</th>
                  <th>جزئیات</th>
                  <th>وضعیت</th>
                  <th>تاریخ ثبت</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>{alert.recipient_name ?? "—"}</td>
                    <td dir="ltr">{alert.phone}</td>
                    <td>{alert.query_text}</td>
                    <td>{[dealTypeLabel(alert.deal_type), propertyTypeLabel(alert.property_type), alert.neighborhood_name].filter(Boolean).join(" · ")}</td>
                    <td><span className={`status-badge status-badge--${alert.is_active ? "approved" : "rejected"}`}>{alert.is_active ? "فعال" : "غیرفعال"}</span></td>
                    <td>{new Date(alert.created_at).toLocaleString("fa-IR")}</td>
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

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminPropertyAssistantSettingsForm from "@/components/AdminPropertyAssistantSettingsForm";
import AdminPropertyAssistantAlerts from "@/components/AdminPropertyAssistantAlerts";

const DEFAULT_ASSISTANT_NAME = "دستیار نیازسنجی هوشمند شما";

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
      <AdminPropertyAssistantAlerts initialAlerts={alerts} canEdit={canEdit} />
    </>
  );
}

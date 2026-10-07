import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminContactInfoForm from "@/components/AdminContactInfoForm";

export default async function AdminContactSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "content.edit");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ویرایش اطلاعات تماس را ندارید.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>اطلاعات تماس سایت</h1>
      </div>
      <p className="form-hint">
        این اطلاعات در صفحهٔ عمومی «تماس با ما» به‌صورت لینک‌های قابل‌کلیک (تماس تلفنی و ورود به شبکه‌های اجتماعی) نمایش داده می‌شود.
      </p>
      <AdminContactInfoForm />
    </>
  );
}

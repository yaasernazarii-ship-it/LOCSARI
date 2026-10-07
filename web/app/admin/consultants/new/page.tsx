import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminConsultantCreateForm from "@/components/AdminConsultantCreateForm";

export default async function AdminNewConsultantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "consultant.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ثبت مشاور جدید را ندارید.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>افزودن مشاور</h1>
        <p>
          اطلاعات مشاور را کامل وارد کنید. اگر کاربری با شمارهٔ ورود داده‌شده قبلاً ثبت‌نام نکرده باشد، حساب کاربری او
          به‌صورت خودکار ساخته می‌شود. پروفایل مشاور بلافاصله تأییدشده ثبت می‌شود و مشاور فقط با ورود پیامکی همان شماره
          مستقیم به حساب کاربری مشاور خود دسترسی خواهد داشت.
        </p>
      </div>
      <AdminConsultantCreateForm />
    </>
  );
}

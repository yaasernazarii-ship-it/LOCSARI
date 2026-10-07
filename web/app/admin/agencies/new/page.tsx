import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminAgencyForm from "@/components/AdminAgencyForm";

export default async function AdminNewAgencyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "agency.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ثبت آژانس جدید را ندارید.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>ثبت آژانس جدید</h1>
        <p>مالک باید از قبل در سایت ثبت‌نام کرده باشد. آژانس ثبت‌شده از این طریق به‌صورت پیش‌فرض تأییدشده خواهد بود.</p>
      </div>
      <AdminAgencyForm mode="create" />
    </>
  );
}

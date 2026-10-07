import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import PropertyAdForm from "@/components/PropertyAdForm";

// ثبت آگهی جدید از پنل مدیریت — از همان فرم/APIهای «ثبت آگهی» کاربران استفاده می‌کند؛
// مالکیت آگهی روی حساب مدیریتی واردشده ثبت می‌شود.
export default async function AdminNewAdvertisementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");

  const [canCreateAd, canCreateProperty] = await Promise.all([
    userHasPermission(user.id, "advertisement.create"),
    userHasPermission(user.id, "property.create"),
  ]);
  if (!canCreateAd || !canCreateProperty) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ثبت آگهی جدید را ندارید.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>ثبت آگهی جدید</h1>
        <p>این آگهی به نام حساب مدیریتی شما ثبت می‌شود و پس از تکمیل، از همین‌جا قابل بررسی و انتشار است.</p>
      </div>
      <PropertyAdForm mode="create" adminMode />
    </>
  );
}

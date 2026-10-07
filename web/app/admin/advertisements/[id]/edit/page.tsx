import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { parseId } from "@/lib/validation";
import PropertyAdForm from "@/components/PropertyAdForm";

// ویرایش آگهی از پنل مدیریت — مجوز دقیق (بازبین مرکزی) در خودِ APIهای properties/advertisements
// نیز بررسی می‌شود؛ این صفحه فقط دسترسی به بخش مدیریت آگهی‌ها و شناسهٔ معتبر را تضمین می‌کند.
export default async function AdminEditAdvertisementPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");

  const [canApprove, canEdit] = await Promise.all([
    userHasPermission(user.id, "advertisement.approve"),
    userHasPermission(user.id, "advertisement.edit"),
  ]);
  if (!canApprove || !canEdit) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ویرایش آگهی را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  return (
    <>
      <div className="admin-page-header">
        <h1>ویرایش آگهی #{id}</h1>
      </div>
      <PropertyAdForm mode="edit" advertisementId={id} adminMode />
    </>
  );
}

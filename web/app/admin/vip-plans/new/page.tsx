import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminVipPlanForm from "@/components/AdminVipPlanForm";

export default async function AdminVipPlanNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "vip.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ایجاد پلن جدید را ندارید.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>پلن VIP جدید</h1>
      </div>
      <AdminVipPlanForm mode="create" />
    </>
  );
}

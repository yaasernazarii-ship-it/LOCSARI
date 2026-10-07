import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import AdminCipPlanForm from "@/components/AdminCipPlanForm";

export default async function AdminCipPlanNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "cip.manage"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز ایجاد پلن CIP را ندارید.</p></div>;
  }

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}><Link href="/admin/cip/plans">← بازگشت به پلن‌های CIP</Link></p>
        <h1>پلن CIP جدید</h1>
      </div>
      <AdminCipPlanForm mode="create" />
    </>
  );
}

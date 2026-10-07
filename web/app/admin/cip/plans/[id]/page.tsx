import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import AdminCipPlanForm from "@/components/AdminCipPlanForm";

export default async function AdminCipPlanEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "cip.manage"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز مدیریت پلن‌های CIP را ندارید.</p></div>;
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const plan = await db.selectFrom("cip_plans").select(["id", "title"]).where("id", "=", id).executeTakeFirst();
  if (!plan) notFound();

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}><Link href="/admin/cip/plans">← بازگشت به پلن‌های CIP</Link></p>
        <h1>{plan.title}</h1>
      </div>
      <AdminCipPlanForm mode="edit" planId={id} />
    </>
  );
}

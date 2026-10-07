import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import AdminVipPlanForm from "@/components/AdminVipPlanForm";

export default async function AdminVipPlanEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "vip.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مدیریت پلن‌های VIP را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const plan = await db.selectFrom("vip_plans").select(["id", "title"]).where("id", "=", id).executeTakeFirst();
  if (!plan) notFound();

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}>
          <Link href="/admin/vip-plans">← بازگشت به پلن‌های VIP</Link>
        </p>
        <h1>{plan.title}</h1>
      </div>
      <AdminVipPlanForm mode="edit" planId={id} />
    </>
  );
}

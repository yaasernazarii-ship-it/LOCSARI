import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission, getUserRoleKeys } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminCipVideoForm from "@/components/AdminCipVideoForm";
import AdminCipFreePublishForm from "@/components/AdminCipFreePublishForm";

export default async function AdminCipPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "cip.manage"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز مدیریت CIP را ندارید.</p></div>;
  }

  const roles = await getUserRoleKeys(user.id);
  const isSuperAdmin = roles.includes("super_admin");

  const [plansCount, requestsCount, pendingCount, freePublishData] = await Promise.all([
    db.selectFrom("cip_plans").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirst().then((r) => Number(r?.count ?? 0)),
    db.selectFrom("cip_requests").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirst().then((r) => Number(r?.count ?? 0)),
    db.selectFrom("cip_requests").select((eb) => eb.fn.countAll<number>().as("count")).where("status", "in", ["paid", "contacted", "scheduled", "filmed"]).executeTakeFirst().then((r) => Number(r?.count ?? 0)),
    isSuperAdmin
      ? Promise.all([
          db.selectFrom("cip_plans").select(["id", "title", "price"]).where("is_active", "=", true).orderBy("sort_order", "asc").execute(),
          db
            .selectFrom("advertisements")
            .innerJoin("users", "users.id", "advertisements.created_by_user_id")
            .select(["advertisements.id", "advertisements.title", "users.name as user_name"])
            .orderBy("advertisements.created_at", "desc")
            .limit(200)
            .execute(),
        ])
      : Promise.resolve(null),
  ]);
  const freePublishPlans = (freePublishData?.[0] ?? []).map((p) => ({ id: p.id, title: p.title, price: Number(p.price) }));
  const freePublishAds = freePublishData?.[1] ?? [];

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>CIP</h1>
          <p>مدیریت پلن‌های تولید ویدیو، درخواست‌های ثبت‌شده و ویدیوی معرفی بخش CIP.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/cip/plans" className="btn-secondary admin-header-btn">پلن‌های CIP ({plansCount.toLocaleString("fa-IR")})</Link>
          <Link href="/admin/cip/requests" className="btn-secondary admin-header-btn">درخواست‌ها ({requestsCount.toLocaleString("fa-IR")})</Link>
          <Link href="/admin/cip/publish" className="btn-primary admin-header-btn">انتشار آگهی CIP</Link>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-card__label">درخواست‌های در جریان</p>
          <p className="kpi-card__value">{pendingCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">کل درخواست‌ها</p>
          <p className="kpi-card__value">{requestsCount.toLocaleString("fa-IR")}</p>
        </div>
      </div>

      <AdminCipVideoForm />
      {isSuperAdmin && <AdminCipFreePublishForm plans={freePublishPlans} advertisements={freePublishAds} />}
    </>
  );
}

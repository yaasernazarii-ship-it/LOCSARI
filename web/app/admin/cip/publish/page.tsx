import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminCipRequestRow from "@/components/AdminCipRequestRow";

const LABELS: Record<string, string> = {
  paid: "پرداخت‌شده",
  contacted: "هماهنگی اولیه",
  scheduled: "تصویربرداری زمان‌بندی شد",
  filmed: "آمادهٔ انتشار",
  published: "منتشرشده",
};

export default async function AdminCipPublishPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "cip.manage"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز مدیریت CIP را ندارید.</p></div>;
  }

  const [requests, consultants] = await Promise.all([
    db
      .selectFrom("cip_requests")
      .innerJoin("cip_plans", "cip_plans.id", "cip_requests.plan_id")
      .innerJoin("advertisements", "advertisements.id", "cip_requests.advertisement_id")
      .innerJoin("users", "users.id", "cip_requests.user_id")
      .leftJoin("consultants", "consultants.id", "cip_requests.assigned_consultant_id")
      .select([
        "cip_requests.id",
        "cip_requests.status",
        "cip_requests.admin_note",
        "cip_requests.video_url",
        "cip_requests.assigned_consultant_id",
        "cip_plans.title as plan_title",
        "advertisements.title as advertisement_title",
        "users.name as user_name",
        "consultants.display_name as consultant_name",
      ])
      .where("cip_requests.status", "in", ["paid", "contacted", "scheduled", "filmed", "published"])
      .orderBy("cip_requests.updated_at", "desc")
      .execute(),
    db.selectFrom("consultants").select(["id", "display_name"]).where("verification_status", "=", "approved").where("is_active", "=", true).orderBy("display_name", "asc").execute(),
  ]);

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>انتشار آگهی‌های CIP</h1>
          <p>ویدیوی نهایی را فقط از این بخش بارگذاری کنید تا آگهی در صفحهٔ عمومی CIP منتشر شود.</p>
        </div>
        <Link href="/admin/cip" className="btn-secondary admin-header-btn">بازگشت به CIP</Link>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>آگهی</th><th>کاربر</th><th>پلن</th><th>وضعیت</th><th>مشاور مسئول</th><th>ویدیو</th><th>انتشار</th></tr></thead>
          <tbody>
            {requests.map((item) => (
              <tr key={item.id}>
                <td>{item.advertisement_title}</td>
                <td>{item.user_name}</td>
                <td>{item.plan_title}</td>
                <td><span className="status-badge status-badge--pending">{LABELS[item.status]}</span></td>
                <td>{item.consultant_name ?? "تعیین نشده"}</td>
                <td>{item.video_url ? <a href={item.video_url} target="_blank">مشاهده</a> : "بارگذاری نشده"}</td>
                <td><AdminCipRequestRow requestId={item.id} status={item.status} adminNote={item.admin_note} videoUrl={item.video_url} consultants={consultants} assignedConsultantId={item.assigned_consultant_id} /></td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={7} className="search-empty">آگهی آمادهٔ انتشار وجود ندارد.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

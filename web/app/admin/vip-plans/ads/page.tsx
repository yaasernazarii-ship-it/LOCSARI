import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminVipAdAssignmentForm from "@/components/AdminVipAdAssignmentForm";

// آگهی‌های VIP فعال + مشاور مسئول پیگیری هر کدام و نتیجهٔ کار — برای واگذاری و رصد عملکرد توسط ادمین.
export default async function AdminVipAdsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "vip.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مدیریت آگهی‌های VIP را ندارید.</p>
      </div>
    );
  }

  const [ads, consultants] = await Promise.all([
    db
      .selectFrom("advertisements")
      .innerJoin("users", "users.id", "advertisements.created_by_user_id")
      .leftJoin("vip_ad_assignments", "vip_ad_assignments.advertisement_id", "advertisements.id")
      .leftJoin("consultants", "consultants.id", "vip_ad_assignments.consultant_id")
      .select([
        "advertisements.id",
        "advertisements.title",
        "advertisements.vip_expires_at",
        "users.name as owner_name",
        "users.phone as owner_phone",
        "vip_ad_assignments.consultant_id",
        "vip_ad_assignments.status as assignment_status",
        "vip_ad_assignments.result_note",
        "consultants.display_name as consultant_name",
      ])
      .where("advertisements.is_vip", "=", true)
      .where((eb) =>
        eb.or([eb("advertisements.vip_expires_at", "is", null), eb("advertisements.vip_expires_at", ">", new Date())])
      )
      .orderBy("advertisements.vip_expires_at", "desc")
      .execute(),
    db
      .selectFrom("consultants")
      .select(["id", "display_name"])
      .where("verification_status", "=", "approved")
      .where("is_active", "=", true)
      .orderBy("display_name", "asc")
      .execute(),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}>
          <Link href="/admin/vip-plans">← بازگشت به پلن‌های VIP</Link>
        </p>
        <h1>آگهی‌های VIP</h1>
        <p>
          {ads.length.toLocaleString("fa-IR")} آگهی VIP فعال — برای هر آگهی مشاور مسئول پیگیری را تعیین کنید و نتیجهٔ کار را
          مشاهده کنید.
        </p>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>آگهی</th>
              <th>مالک آگهی</th>
              <th>مشاور مسئول</th>
              <th>وضعیت پیگیری</th>
              <th>نتیجه</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/admin/advertisements/${a.id}`}>{a.title}</Link>
                </td>
                <td>
                  {a.owner_name}
                  <br />
                  <span style={{ color: "#666" }}>{a.owner_phone}</span>
                </td>
                <AdminVipAdAssignmentForm
                  advertisementId={a.id}
                  consultants={consultants}
                  consultantId={a.consultant_id}
                  status={a.assignment_status ?? "pending"}
                  resultNote={a.result_note}
                />
              </tr>
            ))}
            {ads.length === 0 && (
              <tr>
                <td colSpan={5} className="search-empty">
                  آگهی VIP فعالی وجود ندارد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

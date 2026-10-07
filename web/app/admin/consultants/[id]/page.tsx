import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import { VERIFICATION_STATUS_LABELS } from "@/lib/labels";
import AdminConsultantActions from "@/components/AdminConsultantActions";

export default async function AdminConsultantDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "consultant.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ جزئیات مشاور را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const consultant = await db
    .selectFrom("consultants")
    .innerJoin("users", "users.id", "consultants.user_id")
    .leftJoin("agencies", "agencies.id", "consultants.agency_id")
    .select([
      "consultants.id",
      "consultants.display_name",
      "consultants.slug",
      "consultants.bio",
      "consultants.phone",
      "consultants.license_number",
      "consultants.verification_status",
      "consultants.rejection_reason",
      "consultants.suspension_reason",
      "consultants.is_active",
      "consultants.created_at",
      "users.id as user_id",
      "users.name as user_name",
      "users.phone as user_phone",
      "agencies.id as agency_id",
      "agencies.name as agency_name",
      "agencies.slug as agency_slug",
    ])
    .where("consultants.id", "=", id)
    .executeTakeFirst();

  if (!consultant) notFound();

  const adCount = await db
    .selectFrom("advertisements")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("consultant_id", "=", id)
    .executeTakeFirst();

  const canApprove = await userHasPermission(user.id, "consultant.approve");

  return (
    <>
      <div className="admin-page-header">
        <h1>{consultant.display_name}</h1>
        <p>شناسهٔ مشاور: {consultant.id} · Slug: {consultant.slug}</p>
      </div>

      <div className="admin-actions-bar">
        <span className={`status-badge status-badge--${consultant.verification_status}`}>
          {VERIFICATION_STATUS_LABELS[consultant.verification_status] ?? consultant.verification_status}
        </span>
        <AdminConsultantActions consultantId={consultant.id} status={consultant.verification_status} canApprove={canApprove} />
      </div>

      {consultant.rejection_reason && <p style={{ color: "#991b1b", marginBottom: 16 }}>دلیل رد: {consultant.rejection_reason}</p>}
      {consultant.suspension_reason && <p style={{ color: "#991b1b", marginBottom: 16 }}>دلیل تعلیق: {consultant.suspension_reason}</p>}

      <div className="admin-detail-grid">
        <div>
          <section className="form-section">
            <h2>اطلاعات مشاور</h2>
            <div className="detail-facts">
              <div className="detail-fact">
                <span className="detail-fact__label">تلفن</span>
                <span className="detail-fact__value">{consultant.phone ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">شمارهٔ پروانه</span>
                <span className="detail-fact__value">{consultant.license_number ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">تاریخ ثبت</span>
                <span className="detail-fact__value">{new Date(consultant.created_at).toLocaleString("fa-IR")}</span>
              </div>
            </div>
          </section>

          {consultant.bio && (
            <section className="form-section">
              <h2>دربارهٔ مشاور</h2>
              <p>{consultant.bio}</p>
            </section>
          )}
        </div>

        <div>
          <section className="form-section">
            <h2>کاربر مرتبط</h2>
            <p>{consultant.user_name}</p>
            <p style={{ color: "#666" }}>{consultant.user_phone}</p>
            <Link href={`/admin/users/${consultant.user_id}`}>مشاهدهٔ کاربر</Link>
          </section>

          {consultant.agency_id && (
            <section className="form-section">
              <h2>آژانس</h2>
              <p>{consultant.agency_name}</p>
              <Link href={`/admin/agencies/${consultant.agency_id}`}>مشاهدهٔ آژانس</Link>
            </section>
          )}

          <section className="form-section">
            <h2>آگهی‌ها</h2>
            <p>{Number(adCount?.count ?? 0).toLocaleString("fa-IR")} آگهی ثبت‌شده توسط این مشاور</p>
            <Link href={`/moshaver/${consultant.slug}`}>مشاهدهٔ پروفایل عمومی</Link>
          </section>
        </div>
      </div>
    </>
  );
}

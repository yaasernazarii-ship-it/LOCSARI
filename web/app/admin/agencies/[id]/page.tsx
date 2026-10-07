import Link from "next/link";
import { sql } from "kysely";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import { VERIFICATION_STATUS_LABELS, ADVERTISEMENT_STATUS_LABELS, VIP_SUBSCRIPTION_STATUS_LABELS, formatToman } from "@/lib/labels";
import AdminAgencyActions from "@/components/AdminAgencyActions";

export default async function AdminAgencyDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "agency.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ جزئیات آژانس را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const agency = await db
    .selectFrom("agencies")
    .innerJoin("users", "users.id", "agencies.owner_user_id")
    .innerJoin("cities", "cities.id", "agencies.city_id")
    .select([
      "agencies.id",
      "agencies.name",
      "agencies.slug",
      "agencies.description",
      "agencies.phone",
      "agencies.mobile",
      "agencies.email",
      "agencies.website",
      "agencies.address",
      "agencies.verification_status",
      "agencies.rejection_reason",
      "agencies.suspension_reason",
      "agencies.is_active",
      "agencies.created_at",
      "users.id as owner_id",
      "users.name as owner_name",
      "users.phone as owner_phone",
      "cities.name as city_name",
    ])
    .where("agencies.id", "=", id)
    .executeTakeFirst();

  if (!agency) notFound();

  const [members, advertisements, subscriptions] = await Promise.all([
    db
      .selectFrom("agency_memberships")
      .innerJoin("users", "users.id", "agency_memberships.user_id")
      .select(["agency_memberships.id", "agency_memberships.membership_role", "agency_memberships.status", "users.name", "users.phone"])
      .where("agency_memberships.agency_id", "=", id)
      .execute(),
    db
      .selectFrom("advertisements")
      .innerJoin("users", "users.id", "advertisements.created_by_user_id")
      .select([
        "advertisements.id",
        "advertisements.public_code",
        "advertisements.title",
        "advertisements.status",
        "advertisements.created_at",
        "users.name as creator_name",
        sql<"free" | "vip" | "cip">`case when exists (select 1 from cip_requests where cip_requests.advertisement_id = advertisements.id and cip_requests.status <> 'cancelled') then 'cip' when advertisements.is_vip then 'vip' else 'free' end`.as("advertisement_type"),
      ])
      .where("advertisements.agency_id", "=", id)
      .orderBy("advertisements.created_at", "desc")
      .execute(),
    db
      .selectFrom("vip_subscriptions")
      .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id")
      .select([
        "vip_subscriptions.id",
        "vip_subscriptions.status",
        "vip_subscriptions.price",
        "vip_subscriptions.ad_limit",
        "vip_subscriptions.starts_at",
        "vip_subscriptions.ends_at",
        "vip_subscriptions.created_at",
        "vip_plans.title as plan_title",
      ])
      .where("vip_subscriptions.agency_id", "=", id)
      .orderBy("vip_subscriptions.created_at", "desc")
      .execute(),
  ]);

  const [canApprove, canDelete] = await Promise.all([
    userHasPermission(user.id, "agency.approve"),
    userHasPermission(user.id, "agency.delete"),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>{agency.name}</h1>
        <p>شناسهٔ آژانس: {agency.id} · Slug: {agency.slug}</p>
      </div>

      <div className="admin-actions-bar">
        <span className={`status-badge status-badge--${agency.verification_status}`}>
          {VERIFICATION_STATUS_LABELS[agency.verification_status] ?? agency.verification_status}
        </span>
        <AdminAgencyActions
          agencyId={agency.id}
          status={agency.verification_status}
          canApprove={canApprove}
          canEdit={canApprove}
          canDelete={canDelete}
        />
      </div>

      {agency.rejection_reason && <p style={{ color: "#991b1b", marginBottom: 16 }}>دلیل رد: {agency.rejection_reason}</p>}
      {agency.suspension_reason && <p style={{ color: "#991b1b", marginBottom: 16 }}>دلیل تعلیق: {agency.suspension_reason}</p>}

      <div className="admin-detail-grid">
        <div>
          <section className="form-section">
            <h2>اطلاعات آژانس</h2>
            <div className="detail-facts">
              <div className="detail-fact">
                <span className="detail-fact__label">شهر</span>
                <span className="detail-fact__value">{agency.city_name}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">تلفن</span>
                <span className="detail-fact__value">{agency.phone ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">موبایل</span>
                <span className="detail-fact__value">{agency.mobile ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">ایمیل</span>
                <span className="detail-fact__value">{agency.email ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">وب‌سایت</span>
                <span className="detail-fact__value">{agency.website ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">آدرس</span>
                <span className="detail-fact__value">{agency.address ?? "—"}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">تاریخ ثبت</span>
                <span className="detail-fact__value">{new Date(agency.created_at).toLocaleString("fa-IR")}</span>
              </div>
            </div>
          </section>

          {agency.description && (
            <section className="form-section">
              <h2>توضیحات</h2>
              <p>{agency.description}</p>
            </section>
          )}

          <section className="form-section">
            <h2>اعضای آژانس</h2>
            {members.length === 0 ? (
              <p className="search-empty">هیچ عضوی ثبت نشده است.</p>
            ) : (
              <ul className="admin-history-list">
                {members.map((m) => (
                  <li key={m.id}>
                    {m.name} ({m.phone}) — {m.membership_role} — {m.status}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section className="form-section">
            <h2>مالک</h2>
            <p>{agency.owner_name}</p>
            <p style={{ color: "#666" }}>{agency.owner_phone}</p>
            <Link href={`/admin/users/${agency.owner_id}`}>مشاهدهٔ کاربر</Link>
          </section>

          <section className="form-section">
            <h2>آگهی‌های آژانس</h2>
            {advertisements.length === 0 ? (
              <p className="search-empty">آگهی‌ای برای این آژانس ثبت نشده است.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>شناسه</th>
                      <th>عنوان</th>
                      <th>نوع</th>
                      <th>وضعیت</th>
                      <th>ثبت‌کننده</th>
                      <th>تاریخ ثبت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advertisements.map((ad) => (
                      <tr key={ad.id}>
                        <td dir="ltr">{ad.public_code}</td>
                        <td><Link href={`/admin/advertisements/${ad.id}`}>{ad.title}</Link></td>
                        <td><span className={`status-badge status-badge--${ad.advertisement_type}`}>{ad.advertisement_type === "cip" ? "CIP" : ad.advertisement_type === "vip" ? "VIP" : "رایگان"}</span></td>
                        <td><span className={`status-badge status-badge--${ad.status}`}>{ADVERTISEMENT_STATUS_LABELS[ad.status] ?? ad.status}</span></td>
                        <td>{ad.creator_name}</td>
                        <td>{new Date(ad.created_at).toLocaleDateString("fa-IR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="form-section">
            <h2>اشتراک‌های VIP آژانس</h2>
            {subscriptions.length === 0 ? (
              <p className="search-empty">اشتراک VIP برای این آژانس ثبت نشده است.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>پلن</th>
                      <th>هزینه</th>
                      <th>سقف آگهی</th>
                      <th>وضعیت</th>
                      <th>شروع</th>
                      <th>پایان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td>{subscription.plan_title}</td>
                        <td>{formatToman(Number(subscription.price))}</td>
                        <td>{subscription.ad_limit.toLocaleString("fa-IR")}</td>
                        <td><span className={`status-badge status-badge--${subscription.status}`}>{VIP_SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status}</span></td>
                        <td>{subscription.starts_at ? new Date(subscription.starts_at).toLocaleDateString("fa-IR") : "—"}</td>
                        <td>{subscription.ends_at ? new Date(subscription.ends_at).toLocaleDateString("fa-IR") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

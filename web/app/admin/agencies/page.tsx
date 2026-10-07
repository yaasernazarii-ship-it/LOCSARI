import Link from "next/link";
import { sql } from "kysely";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { VERIFICATION_STATUSES } from "@/lib/validation";
import { VERIFICATION_STATUS_LABELS } from "@/lib/labels";
import AdminPagination from "@/components/AdminPagination";
import AdminAgencyRowActions from "@/components/AdminAgencyRowActions";

const PAGE_SIZE = 20;

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "agency.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ آژانس‌ها را ندارید.</p>
      </div>
    );
  }

  const status = searchParams.status && VERIFICATION_STATUSES.includes(searchParams.status as any) ? searchParams.status : undefined;
  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const [canEdit, canDelete] = await Promise.all([
    userHasPermission(user.id, "agency.approve"),
    userHasPermission(user.id, "agency.delete"),
  ]);

  function buildQuery() {
    let query = db.selectFrom("agencies").innerJoin("users", "users.id", "agencies.owner_user_id").innerJoin("cities", "cities.id", "agencies.city_id");
    if (status) query = query.where("agencies.verification_status", "=", status);
    if (q) {
      query = query.where((eb) => eb.or([eb("agencies.name", "ilike", `%${q}%`), eb("users.phone", "ilike", `%${q}%`)]));
    }
    return query;
  }

  const [{ count } = { count: 0 }, agencies] = await Promise.all([
    buildQuery()
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst() as Promise<{ count: number }>,
    buildQuery()
      .select([
        "agencies.id",
        "agencies.name",
        "agencies.phone",
        "agencies.mobile",
        "agencies.verification_status",
        "agencies.is_active",
        "agencies.created_at",
        "users.name as owner_name",
        "users.phone as owner_phone",
        "cities.name as city_name",
        sql<number>`(select count(*)::int from advertisements where advertisements.agency_id = agencies.id)`.as("advertisement_count"),
        sql<string>`coalesce((select string_agg(vip_plans.title, '، ' order by vip_subscriptions.created_at desc) from vip_subscriptions inner join vip_plans on vip_plans.id = vip_subscriptions.plan_id where vip_subscriptions.agency_id = agencies.id), '—')`.as("subscription_titles"),
      ])
      .orderBy("agencies.created_at", "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));
  const columnCount = (canEdit || canDelete) ? 9 : 8;

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>آژانس‌ها</h1>
          <p>{Number(count).toLocaleString("fa-IR")} آژانس یافت شد</p>
        </div>
        {canEdit && (
          <Link href="/admin/agencies/new" className="btn-primary admin-header-btn">
            + ثبت آژانس جدید
          </Link>
        )}
      </div>

      <form method="get" className="admin-filters">
        <input type="text" name="q" placeholder="جستجوی نام یا موبایل مالک" defaultValue={q ?? ""} />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">همهٔ وضعیت‌ها</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {VERIFICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn-primary" type="submit">
          اعمال فیلتر
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>شهر</th>
              <th>مالک</th>
              <th>تماس</th>
              <th>آگهی‌ها</th>
              <th>اشتراک‌های VIP</th>
              <th>وضعیت</th>
              <th>تاریخ ثبت</th>
              {(canEdit || canDelete) && <th>عملیات</th>}
            </tr>
          </thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/admin/agencies/${a.id}`}>{a.name}</Link>
                </td>
                <td>{a.city_name}</td>
                <td>
                  {a.owner_name}
                  <br />
                  <span style={{ color: "#666" }}>{a.owner_phone}</span>
                </td>
                <td>{a.mobile ?? a.phone ?? "—"}</td>
                <td>{a.advertisement_count.toLocaleString("fa-IR")} آگهی</td>
                <td>{a.subscription_titles}</td>
                <td>
                  <span className={`status-badge status-badge--${a.verification_status}`}>
                    {VERIFICATION_STATUS_LABELS[a.verification_status] ?? a.verification_status}
                  </span>
                </td>
                <td>{new Date(a.created_at).toLocaleDateString("fa-IR")}</td>
                {(canEdit || canDelete) && (
                  <td>
                    <AdminAgencyRowActions agencyId={a.id} canEdit={canEdit} canDelete={canDelete} />
                  </td>
                )}
              </tr>
            ))}
            {agencies.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="search-empty">
                  آژانسی یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination basePath="/admin/agencies" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}

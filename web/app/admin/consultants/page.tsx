import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { VERIFICATION_STATUSES } from "@/lib/validation";
import { VERIFICATION_STATUS_LABELS } from "@/lib/labels";
import AdminPagination from "@/components/AdminPagination";

const PAGE_SIZE = 20;

export default async function AdminConsultantsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "consultant.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ مشاوران را ندارید.</p>
      </div>
    );
  }

  const status = searchParams.status && VERIFICATION_STATUSES.includes(searchParams.status as any) ? searchParams.status : undefined;
  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  function buildQuery() {
    let query = db
      .selectFrom("consultants")
      .innerJoin("users", "users.id", "consultants.user_id")
      .leftJoin("agencies", "agencies.id", "consultants.agency_id");
    if (status) query = query.where("consultants.verification_status", "=", status);
    if (q) {
      query = query.where((eb) =>
        eb.or([eb("consultants.display_name", "ilike", `%${q}%`), eb("users.phone", "ilike", `%${q}%`)]),
      );
    }
    return query;
  }

  const [{ count } = { count: 0 }, consultants] = await Promise.all([
    buildQuery()
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst() as Promise<{ count: number }>,
    buildQuery()
      .select([
        "consultants.id",
        "consultants.display_name",
        "consultants.phone",
        "consultants.license_number",
        "consultants.verification_status",
        "consultants.created_at",
        "users.name as user_name",
        "users.phone as user_phone",
        "agencies.name as agency_name",
      ])
      .orderBy("consultants.created_at", "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  return (
    <>
      <div className="admin-page-header admin-page-header--row">
        <div>
          <h1>مشاوران</h1>
          <p>{Number(count).toLocaleString("fa-IR")} مشاور یافت شد</p>
        </div>
        <Link href="/admin/consultants/new" className="btn-primary admin-header-btn">
          + افزودن مشاور
        </Link>
      </div>

      <form method="get" className="admin-filters">
        <input type="text" name="q" placeholder="جستجوی نام یا موبایل" defaultValue={q ?? ""} />
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
              <th>نام نمایشی</th>
              <th>کاربر</th>
              <th>آژانس</th>
              <th>شمارهٔ پروانه</th>
              <th>وضعیت</th>
              <th>تاریخ ثبت</th>
            </tr>
          </thead>
          <tbody>
            {consultants.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/consultants/${c.id}`}>{c.display_name}</Link>
                </td>
                <td>
                  {c.user_name}
                  <br />
                  <span style={{ color: "#666" }}>{c.user_phone}</span>
                </td>
                <td>{c.agency_name ?? "—"}</td>
                <td>{c.license_number ?? "—"}</td>
                <td>
                  <span className={`status-badge status-badge--${c.verification_status}`}>
                    {VERIFICATION_STATUS_LABELS[c.verification_status] ?? c.verification_status}
                  </span>
                </td>
                <td>{new Date(c.created_at).toLocaleDateString("fa-IR")}</td>
              </tr>
            ))}
            {consultants.length === 0 && (
              <tr>
                <td colSpan={6} className="search-empty">
                  مشاوری یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination basePath="/admin/consultants" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}

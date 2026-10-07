import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminPagination from "@/components/AdminPagination";

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = { create: "ایجاد", update: "به‌روزرسانی", delete: "حذف" };
const ENTITY_LABELS: Record<string, string> = {
  category: "دسته‌بندی",
  city: "شهر",
  district: "موقعیت ملک",
  market_zone: "موقعیت ملک",
  neighborhood: "موقعیت ملک",
  province: "استان",
  advertisement: "آگهی",
  agency: "آژانس",
  consultant: "مشاور",
  advertisement_inquiry: "درخواست",
  site_page: "صفحهٔ محتوا",
  vip_plan: "پلن VIP",
  vip_subscription: "اشتراک VIP",
  cip_video: "ویدیوی CIP",
};

type SP = Record<string, string | undefined>;

// تاریخچهٔ تغییرات مدیریتی — بر پایهٔ admin_audit_logs، شامل پلن/اشتراک VIP، تنظیمات CIP و سایر موجودیت‌ها.
export default async function AdminAuditLogPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "admin.dashboard.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ تاریخچهٔ تغییرات را ندارید.</p>
      </div>
    );
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const entityType = searchParams.entityType?.trim() || undefined;
  const action = searchParams.action?.trim() || undefined;
  const q = searchParams.q?.trim() || undefined;

  function buildQuery() {
    let query = db.selectFrom("admin_audit_logs").leftJoin("users", "users.id", "admin_audit_logs.user_id");
    if (entityType) query = query.where("admin_audit_logs.entity_type", "=", entityType);
    if (action) query = query.where("admin_audit_logs.action", "=", action);
    if (q) {
      const numericId = /^\d+$/.test(q) ? Number(q) : null;
      query = query.where((eb) =>
        eb.or([
          eb("users.name", "ilike", `%${q}%`),
          eb("admin_audit_logs.meta", "ilike", `%${q}%`),
          ...(numericId ? [eb("admin_audit_logs.entity_id", "=", numericId)] : []),
        ])
      );
    }
    return query;
  }

  const [{ count }, rows, entityTypeRows] = await Promise.all([
    buildQuery()
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow(),
    buildQuery()
      .select([
        "admin_audit_logs.id",
        "admin_audit_logs.action",
        "admin_audit_logs.entity_type",
        "admin_audit_logs.entity_id",
        "admin_audit_logs.meta",
        "admin_audit_logs.created_at",
        "users.name as user_name",
      ])
      .orderBy("admin_audit_logs.created_at", "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
    db.selectFrom("admin_audit_logs").select("entity_type").distinct().orderBy("entity_type", "asc").execute(),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}>
          <Link href="/admin/settings">← بازگشت به تنظیمات</Link>
        </p>
        <h1>تاریخچهٔ تغییرات</h1>
        <p>{Number(count).toLocaleString("fa-IR")} رخداد مطابق فیلترهای فعلی.</p>
      </div>

      <div className="admin-filters">
        <form method="get">
          <div>
            <label htmlFor="q">جستجو (کاربر / شناسه / متن تغییر)</label>
            <input type="text" id="q" name="q" defaultValue={q ?? ""} />
          </div>
          <div>
            <label htmlFor="entityType">نوع موجودیت</label>
            <select id="entityType" name="entityType" defaultValue={entityType ?? ""}>
              <option value="">همه</option>
              {entityTypeRows.map((r) => (
                <option key={r.entity_type} value={r.entity_type}>
                  {ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action">نوع عملیات</label>
            <select id="action" name="action" defaultValue={action ?? ""}>
              <option value="">همه</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-filters__submit">
            <button type="submit" className="btn-primary" style={{ width: "auto", padding: "9px 20px" }}>
              اعمال فیلتر
            </button>
          </div>
        </form>
      </div>

      <div className="admin-table-wrap">
        {rows.length === 0 ? (
          <p className="admin-table-empty">رخدادی مطابق فیلترها یافت نشد.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>کاربر</th>
                <th>عملیات</th>
                <th>موجودیت</th>
                <th>شناسه</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString("fa-IR")}</td>
                  <td>{r.user_name ?? "—"}</td>
                  <td>{ACTION_LABELS[r.action] ?? r.action}</td>
                  <td>{ENTITY_LABELS[r.entity_type] ?? r.entity_type}</td>
                  <td>{r.entity_id}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem", maxWidth: 360, overflowWrap: "anywhere" }}>
                    {r.meta ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminPagination basePath="/admin/settings/audit-log" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}

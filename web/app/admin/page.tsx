import Link from "next/link";
import { ClipboardList, Clock, CheckCircle2, XCircle, Ban, Users, Building2, UserCheck, type LucideIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";

function KpiIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="kpi-card__icon">
      <Icon size={18} />
    </span>
  );
}

// داشبورد اصلی مدیریت (فاز ۷.۱) — همهٔ اعداد مستقیماً از دیتابیس؛ هیچ عدد ثابت/فرضی‌ای نمایش داده نمی‌شود.
// دسترسی به خودِ /admin در layout.tsx بررسی شده (admin.dashboard.view)؛ اینجا فقط محتوا ساخته می‌شود.

async function countRows(table: "advertisements" | "agencies" | "consultants" | "users", where?: [string, unknown][]): Promise<number> {
  let q = db.selectFrom(table).select((eb) => eb.fn.countAll<number>().as("count"));
  if (where) {
    for (const [col, val] of where) {
      q = q.where(col as never, "=", val as never);
    }
  }
  const row = await q.executeTakeFirst();
  return Number(row?.count ?? 0);
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout قبلاً redirect می‌کند

  const [canViewAds, canViewUsers, canViewAgencies, canViewConsultants] = await Promise.all([
    userHasPermission(user.id, "advertisement.approve"),
    userHasPermission(user.id, "user.manage"),
    userHasPermission(user.id, "agency.approve"),
    userHasPermission(user.id, "consultant.approve"),
  ]);

  const [
    adTotal,
    adPending,
    adPublished,
    adExpired,
    adRejected,
    usersTotal,
    usersNew,
    agenciesTotal,
    agenciesPending,
    consultantsTotal,
    consultantsActive,
  ] = await Promise.all([
    canViewAds ? countRows("advertisements") : Promise.resolve(0),
    canViewAds ? countRows("advertisements", [["status", "pending_review"]]) : Promise.resolve(0),
    canViewAds ? countRows("advertisements", [["status", "published"]]) : Promise.resolve(0),
    canViewAds ? countRows("advertisements", [["status", "expired"]]) : Promise.resolve(0),
    canViewAds ? countRows("advertisements", [["status", "rejected"]]) : Promise.resolve(0),
    canViewUsers ? countRows("users") : Promise.resolve(0),
    canViewUsers
      ? db
          .selectFrom("users")
          .select((eb) => eb.fn.countAll<number>().as("count"))
          .where("created_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .executeTakeFirst()
          .then((r) => Number(r?.count ?? 0))
      : Promise.resolve(0),
    canViewAgencies ? countRows("agencies") : Promise.resolve(0),
    canViewAgencies ? countRows("agencies", [["verification_status", "pending"]]) : Promise.resolve(0),
    canViewConsultants ? countRows("consultants") : Promise.resolve(0),
    canViewConsultants
      ? db
          .selectFrom("consultants")
          .select((eb) => eb.fn.countAll<number>().as("count"))
          .where("verification_status", "=", "approved")
          .where("is_active", "=", true)
          .executeTakeFirst()
          .then((r) => Number(r?.count ?? 0))
      : Promise.resolve(0),
  ]);

  const [recentActivity, pendingReview] = await Promise.all([
    db
      .selectFrom("admin_audit_logs")
      .leftJoin("users", "users.id", "admin_audit_logs.user_id")
      .select([
        "admin_audit_logs.id",
        "admin_audit_logs.action",
        "admin_audit_logs.entity_type",
        "admin_audit_logs.entity_id",
        "admin_audit_logs.created_at",
        "users.name as user_name",
      ])
      .orderBy("admin_audit_logs.created_at", "desc")
      .limit(10)
      .execute(),
    canViewAds
      ? db
          .selectFrom("advertisements")
          .innerJoin("properties", "properties.id", "advertisements.property_id")
          .innerJoin("categories", "categories.id", "properties.category_id")
          .innerJoin("users", "users.id", "advertisements.created_by_user_id")
          .select([
            "advertisements.id",
            "advertisements.title",
            "advertisements.created_at",
            "categories.name as category_name",
            "users.name as owner_name",
          ])
          .where("advertisements.status", "=", "pending_review")
          .orderBy("advertisements.created_at", "asc")
          .limit(10)
          .execute()
      : Promise.resolve([]),
  ]);

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

  return (
    <>
      <div className="admin-page-header">
        <h1>داشبورد مدیریت</h1>
        <p>خوش آمدید، {user.name}. نمای کلی وضعیت فعلی پلتفرم بر اساس داده‌های واقعی.</p>
      </div>

      <div className="kpi-grid">
        {canViewAds && (
          <>
            <div className="kpi-card">
              <KpiIcon icon={ClipboardList} />
              <p className="kpi-card__label">کل آگهی‌ها</p>
              <p className="kpi-card__value">{adTotal.toLocaleString("fa-IR")}</p>
            </div>
            <div className="kpi-card">
              <KpiIcon icon={Clock} />
              <p className="kpi-card__label">در انتظار بررسی</p>
              <p className="kpi-card__value">{adPending.toLocaleString("fa-IR")}</p>
            </div>
            <div className="kpi-card">
              <KpiIcon icon={CheckCircle2} />
              <p className="kpi-card__label">منتشرشده</p>
              <p className="kpi-card__value">{adPublished.toLocaleString("fa-IR")}</p>
            </div>
            <div className="kpi-card">
              <KpiIcon icon={XCircle} />
              <p className="kpi-card__label">منقضی‌شده</p>
              <p className="kpi-card__value">{adExpired.toLocaleString("fa-IR")}</p>
            </div>
            <div className="kpi-card">
              <KpiIcon icon={Ban} />
              <p className="kpi-card__label">ردشده</p>
              <p className="kpi-card__value">{adRejected.toLocaleString("fa-IR")}</p>
            </div>
          </>
        )}
        {canViewUsers && (
          <div className="kpi-card">
            <KpiIcon icon={Users} />
            <p className="kpi-card__label">کل کاربران</p>
            <p className="kpi-card__value">{usersTotal.toLocaleString("fa-IR")}</p>
            <p className="kpi-card__sub">{usersNew.toLocaleString("fa-IR")} کاربر جدید (۷ روز اخیر)</p>
          </div>
        )}
        {canViewAgencies && (
          <div className="kpi-card">
            <KpiIcon icon={Building2} />
            <p className="kpi-card__label">کل آژانس‌ها</p>
            <p className="kpi-card__value">{agenciesTotal.toLocaleString("fa-IR")}</p>
            <p className="kpi-card__sub">{agenciesPending.toLocaleString("fa-IR")} در انتظار تأیید</p>
          </div>
        )}
        {canViewConsultants && (
          <div className="kpi-card">
            <KpiIcon icon={UserCheck} />
            <p className="kpi-card__label">کل مشاوران</p>
            <p className="kpi-card__value">{consultantsTotal.toLocaleString("fa-IR")}</p>
            <p className="kpi-card__sub">{consultantsActive.toLocaleString("fa-IR")} فعال و تأییدشده</p>
          </div>
        )}
      </div>

      <div className="admin-quick-actions">
        {canViewAds && <Link href="/admin/advertisements?status=pending_review">بررسی آگهی‌های در انتظار</Link>}
        {canViewAgencies && <Link href="/admin/agencies?status=pending">تأیید آژانس‌های در انتظار</Link>}
        {canViewAgencies && <Link href="/admin/agencies/new">+ ثبت آژانس جدید</Link>}
        {canViewConsultants && <Link href="/admin/consultants?status=pending">تأیید مشاوران در انتظار</Link>}
      </div>

      <div className="admin-grid-2">
        <section className="form-section">
          <h2>در انتظار بررسی</h2>
          {!canViewAds ? (
            <p className="search-empty">دسترسی به این بخش ندارید.</p>
          ) : pendingReview.length === 0 ? (
            <p className="search-empty">هیچ آگهی‌ای در انتظار بررسی نیست.</p>
          ) : (
            <ul className="admin-activity-list">
              {pendingReview.map((ad) => (
                <li key={ad.id}>
                  <Link href={`/admin/advertisements/${ad.id}`}>{ad.title}</Link> — {ad.category_name} — ثبت‌شده توسط {ad.owner_name}
                  <time>{new Date(ad.created_at).toLocaleString("fa-IR")}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-section">
          <h2>فعالیت‌های اخیر</h2>
          {recentActivity.length === 0 ? (
            <p className="search-empty">هنوز فعالیتی ثبت نشده است.</p>
          ) : (
            <ul className="admin-activity-list">
              {recentActivity.map((log) => (
                <li key={log.id}>
                  {log.user_name ?? "سیستم"} — {ACTION_LABELS[log.action] ?? log.action} {ENTITY_LABELS[log.entity_type] ?? log.entity_type} #
                  {log.entity_id}
                  <time>{new Date(log.created_at).toLocaleString("fa-IR")}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

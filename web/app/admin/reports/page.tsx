import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";

// گزارش‌های تحلیلی پلتفرم (بدون CRM) — همه اعداد مستقیماً از دیتابیس محاسبه می‌شوند.

const STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  pending_review: "در انتظار بررسی",
  published: "منتشرشده",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  sold: "فروخته‌شده",
  rented: "اجاره‌شده",
  archived: "آرشیوشده",
};

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="report-bar">
      <span className="report-bar__label">{label}</span>
      <div className="report-bar__track">
        <div className="report-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="report-bar__value">{count.toLocaleString("fa-IR")}</span>
    </div>
  );
}

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "admin.dashboard.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ گزارش‌ها را ندارید.</p>
      </div>
    );
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    adsByStatus,
    adsByTransactionType,
    topCategories,
    topPropertyLocations,
    dailyAdsTrend,
    agenciesByStatus,
    consultantsByStatus,
    inquiriesByStatus,
    inquiriesByType,
    newAdsLast30,
    newUsersLast30,
    pendingEvents,
    publishedEvents,
    activeVipSubscriptions,
    paidVipRevenue,
    vipUsageByAgency,
  ] = await Promise.all([
    db.selectFrom("advertisements").select("status").select((eb) => eb.fn.countAll<number>().as("count")).groupBy("status").execute(),
    db.selectFrom("advertisements").select("transaction_type").select((eb) => eb.fn.countAll<number>().as("count")).groupBy("transaction_type").execute(),
    db
      .selectFrom("advertisements")
      .innerJoin("properties", "properties.id", "advertisements.property_id")
      .innerJoin("categories", "categories.id", "properties.category_id")
      .select("categories.name as category_name")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .groupBy("categories.name")
      .orderBy(sql`count(*)`, "desc")
      .limit(8)
      .execute(),
    db
      .selectFrom("advertisements")
      .innerJoin("properties", "properties.id", "advertisements.property_id")
      .innerJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
      .select("neighborhoods.name as location_name")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .groupBy("neighborhoods.name")
      .orderBy(sql`count(*)`, "desc")
      .limit(8)
      .execute(),
    db
      .selectFrom("advertisements")
      .select(sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`.as("day"))
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("created_at", ">=", fourteenDaysAgo)
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`, "asc")
      .execute(),
    db.selectFrom("agencies").select("verification_status").select((eb) => eb.fn.countAll<number>().as("count")).groupBy("verification_status").execute(),
    db.selectFrom("consultants").select("verification_status").select((eb) => eb.fn.countAll<number>().as("count")).groupBy("verification_status").execute(),
    db.selectFrom("advertisement_inquiries").select("status").select((eb) => eb.fn.countAll<number>().as("count")).groupBy("status").execute(),
    db.selectFrom("advertisement_inquiries").select("type").select((eb) => eb.fn.countAll<number>().as("count")).groupBy("type").execute(),
    db
      .selectFrom("advertisements")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("created_at", ">=", thirtyDaysAgo)
      .executeTakeFirst(),
    db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("created_at", ">=", thirtyDaysAgo)
      .executeTakeFirst(),
    db
      .selectFrom("advertisement_status_history")
      .select(["advertisement_id"])
      .select((eb) => eb.fn.min("created_at").as("at"))
      .where("to_status", "=", "pending_review")
      .groupBy("advertisement_id")
      .execute(),
    db
      .selectFrom("advertisement_status_history")
      .select(["advertisement_id"])
      .select((eb) => eb.fn.min("created_at").as("at"))
      .where("to_status", "=", "published")
      .groupBy("advertisement_id")
      .execute(),
    db
      .selectFrom("vip_subscriptions")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("status", "=", "active")
      .executeTakeFirst(),
    db
      .selectFrom("payment_orders")
      .select((eb) => eb.fn.sum<string>("amount_rial").as("amount_rial"))
      .where("status", "=", "paid")
      .executeTakeFirst(),
    db
      .selectFrom("vip_subscriptions")
      .leftJoin("agencies", "agencies.id", "vip_subscriptions.agency_id")
      .select([
        "vip_subscriptions.agency_id",
        "agencies.name as agency_name",
      ])
      .select((eb) => eb.fn.countAll<number>().as("subscription_count"))
      .where("vip_subscriptions.status", "=", "active")
      .groupBy(["vip_subscriptions.agency_id", "agencies.name"])
      .orderBy(sql`count(*)`, "desc")
      .limit(10)
      .execute(),
  ]);

  // میانگین زمان بررسی: فاصلهٔ ورود به «در انتظار بررسی» تا لحظهٔ انتشار، برای هر آگهی
  const pendingMap = new Map(pendingEvents.map((r) => [r.advertisement_id, new Date(r.at as unknown as string)]));
  let totalHours = 0;
  let pairCount = 0;
  for (const pub of publishedEvents) {
    const pendingAt = pendingMap.get(pub.advertisement_id);
    const publishedAt = new Date(pub.at as unknown as string);
    if (pendingAt && publishedAt.getTime() > pendingAt.getTime()) {
      totalHours += (publishedAt.getTime() - pendingAt.getTime()) / (1000 * 60 * 60);
      pairCount++;
    }
  }
  const avgReviewHours = pairCount > 0 ? totalHours / pairCount : null;

  const statusMap = new Map(adsByStatus.map((r) => [r.status, Number(r.count)]));
  const publishedCount = statusMap.get("published") ?? 0;
  const rejectedCount = statusMap.get("rejected") ?? 0;
  const approvalRate = publishedCount + rejectedCount > 0 ? Math.round((publishedCount / (publishedCount + rejectedCount)) * 100) : null;
  const vipRevenueToman = Math.round(Number(paidVipRevenue?.amount_rial ?? 0) / 10);

  const maxStatusCount = Math.max(1, ...adsByStatus.map((r) => Number(r.count)));
  const maxTxCount = Math.max(1, ...adsByTransactionType.map((r) => Number(r.count)));
  const maxCategoryCount = Math.max(1, ...topCategories.map((r) => Number(r.count)));
  const maxPropertyLocationCount = Math.max(1, ...topPropertyLocations.map((r) => Number(r.count)));
  const maxDailyCount = Math.max(1, ...dailyAdsTrend.map((r) => Number(r.count)));
  const maxInquiryTypeCount = Math.max(1, ...inquiriesByType.map((r) => Number(r.count)));

  const AGENCY_STATUS_LABELS: Record<string, string> = { pending: "در انتظار تأیید", approved: "تأییدشده", rejected: "ردشده", suspended: "معلق" };
  const REQUEST_TYPE_LABELS: Record<string, string> = { call: "درخواست تماس", visit: "درخواست بازدید" };
  const REQUEST_STATUS_LABELS: Record<string, string> = { new: "جدید", contacted: "تماس گرفته‌شده", scheduled: "زمان‌بندی‌شده", done: "انجام‌شده", cancelled: "لغوشده" };

  return (
    <>
      <div className="admin-page-header fade-in">
        <h1>گزارش‌ها</h1>
        <p>نمای تحلیلی از عملکرد پلتفرم بر اساس داده‌های واقعی — بدون بخش CRM.</p>
      </div>

      <div className="kpi-grid fade-in">
        <div className="kpi-card">
          <p className="kpi-card__label">آگهی منتشرشده</p>
          <p className="kpi-card__value">{publishedCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">نرخ تأیید آگهی</p>
          <p className="kpi-card__value">{approvalRate !== null ? `${approvalRate.toLocaleString("fa-IR")}٪` : "—"}</p>
          <p className="kpi-card__sub">از میان آگهی‌های بررسی‌شده (منتشر یا رد)</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">میانگین زمان بررسی</p>
          <p className="kpi-card__value">
            {avgReviewHours !== null ? `${Math.round(avgReviewHours).toLocaleString("fa-IR")} ساعت` : "—"}
          </p>
          <p className="kpi-card__sub">از ارسال برای بررسی تا انتشار</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">آگهی ثبت‌شده (۳۰ روز اخیر)</p>
          <p className="kpi-card__value">{Number(newAdsLast30?.count ?? 0).toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">اشتراک VIP فعال</p>
          <p className="kpi-card__value">{Number(activeVipSubscriptions?.count ?? 0).toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">درآمد پرداخت‌شدهٔ VIP</p>
          <p className="kpi-card__value">{vipRevenueToman.toLocaleString("fa-IR")} تومان</p>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="form-section fade-in">
          <h2>روند ثبت آگهی (۱۴ روز اخیر)</h2>
          {dailyAdsTrend.length === 0 ? (
            <p className="search-empty">داده‌ای برای این بازه ثبت نشده است.</p>
          ) : (
            <div className="report-bar-list">
              {dailyAdsTrend.map((r) => (
                <Bar key={r.day} label={new Date(r.day).toLocaleDateString("fa-IR", { month: "short", day: "numeric" })} count={Number(r.count)} max={maxDailyCount} />
              ))}
            </div>
          )}
        </section>

        <section className="form-section fade-in">
          <h2>آگهی به تفکیک وضعیت</h2>
          <div className="report-bar-list">
            {adsByStatus.map((r) => (
              <Bar key={r.status} label={STATUS_LABELS[r.status] ?? r.status} count={Number(r.count)} max={maxStatusCount} />
            ))}
          </div>
        </section>

        <section className="form-section fade-in">
          <h2>آگهی به تفکیک نوع معامله</h2>
          <div className="report-bar-list">
            {adsByTransactionType.map((r) => (
              <Bar
                key={r.transaction_type}
                label={TRANSACTION_TYPE_LABELS[r.transaction_type as keyof typeof TRANSACTION_TYPE_LABELS] ?? r.transaction_type}
                count={Number(r.count)}
                max={maxTxCount}
              />
            ))}
          </div>
        </section>

        <section className="form-section fade-in">
          <h2>پرآگهی‌ترین دسته‌بندی‌ها</h2>
          {topCategories.length === 0 ? (
            <p className="search-empty">هنوز آگهی‌ای ثبت نشده است.</p>
          ) : (
            <div className="report-bar-list">
              {topCategories.map((r) => (
                <Bar key={r.category_name} label={r.category_name} count={Number(r.count)} max={maxCategoryCount} />
              ))}
            </div>
          )}
        </section>

        <section className="form-section fade-in">
          <h2>پرآگهی‌ترین موقعیت‌های ملک</h2>
          {topPropertyLocations.length === 0 ? (
            <p className="search-empty">هنوز آگهی‌ای با موقعیت ملک مشخص ثبت نشده است.</p>
          ) : (
            <div className="report-bar-list">
              {topPropertyLocations.map((r) => (
                <Bar key={r.location_name} label={r.location_name} count={Number(r.count)} max={maxPropertyLocationCount} />
              ))}
            </div>
          )}
        </section>

        <section className="form-section fade-in">
          <h2>درخواست‌های تماس/بازدید</h2>
          <div className="report-bar-list">
            {inquiriesByType.map((r) => (
              <Bar key={r.type} label={REQUEST_TYPE_LABELS[r.type] ?? r.type} count={Number(r.count)} max={maxInquiryTypeCount} />
            ))}
          </div>
          {inquiriesByStatus.length > 0 && (
            <table className="admin-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>وضعیت</th>
                  <th>تعداد</th>
                </tr>
              </thead>
              <tbody>
                {inquiriesByStatus.map((r) => (
                  <tr key={r.status}>
                    <td>{REQUEST_STATUS_LABELS[r.status] ?? r.status}</td>
                    <td>{Number(r.count).toLocaleString("fa-IR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="form-section fade-in">
          <h2>وضعیت تأیید آژانس‌ها</h2>
          {agenciesByStatus.length === 0 ? (
            <p className="search-empty">هنوز آژانسی ثبت نشده است.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>وضعیت</th>
                  <th>تعداد</th>
                </tr>
              </thead>
              <tbody>
                {agenciesByStatus.map((r) => (
                  <tr key={r.verification_status}>
                    <td>{AGENCY_STATUS_LABELS[r.verification_status] ?? r.verification_status}</td>
                    <td>{Number(r.count).toLocaleString("fa-IR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="form-section fade-in">
          <h2>اشتراک‌های فعال VIP به تفکیک آژانس</h2>
          {vipUsageByAgency.length === 0 ? (
            <p className="search-empty">اشتراک فعال VIP وجود ندارد.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>آژانس</th>
                  <th>تعداد اشتراک فعال</th>
                </tr>
              </thead>
              <tbody>
                {vipUsageByAgency.map((row) => (
                  <tr key={row.agency_id ?? "individual"}>
                    <td>{row.agency_name ?? "بدون آژانس"}</td>
                    <td>{Number(row.subscription_count).toLocaleString("fa-IR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="form-section fade-in">
          <h2>وضعیت تأیید مشاوران</h2>
          {consultantsByStatus.length === 0 ? (
            <p className="search-empty">هنوز مشاوری ثبت نشده است.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>وضعیت</th>
                  <th>تعداد</th>
                </tr>
              </thead>
              <tbody>
                {consultantsByStatus.map((r) => (
                  <tr key={r.verification_status}>
                    <td>{AGENCY_STATUS_LABELS[r.verification_status] ?? r.verification_status}</td>
                    <td>{Number(r.count).toLocaleString("fa-IR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

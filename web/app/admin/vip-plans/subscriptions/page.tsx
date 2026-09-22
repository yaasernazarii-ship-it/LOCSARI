import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { VIP_SUBSCRIPTION_STATUSES } from "@/lib/validation";
import { VIP_SUBSCRIPTION_STATUS_LABELS, formatToman } from "@/lib/labels";
import AdminPagination from "@/components/AdminPagination";
import AdminVipSubscriptionActions from "@/components/AdminVipSubscriptionActions";

const PAGE_SIZE = 20;

// گزارش و مدیریت درخواست‌های خرید اشتراک VIP.
export default async function AdminVipSubscriptionsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "vip.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مدیریت اشتراک‌های VIP را ندارید.</p>
      </div>
    );
  }

  const status = searchParams.status && (VIP_SUBSCRIPTION_STATUSES as readonly string[]).includes(searchParams.status)
    ? searchParams.status
    : undefined;
  const paymentStatus = ["pending", "paid", "failed", "expired"].includes(searchParams.paymentStatus ?? "")
    ? searchParams.paymentStatus
    : undefined;
  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  function buildQuery() {
    let query = db
      .selectFrom("vip_subscriptions")
      .innerJoin("users", "users.id", "vip_subscriptions.user_id")
      .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id")
      .leftJoin("payment_orders", "payment_orders.subscription_id", "vip_subscriptions.id");
    if (status) query = query.where("vip_subscriptions.status", "=", status);
    if (paymentStatus) query = query.where("payment_orders.status", "=", paymentStatus);
    if (q) query = query.where((eb) => eb.or([
      eb("users.name", "ilike", `%${q}%`),
      eb("users.phone", "ilike", `%${q}%`),
      eb("vip_plans.title", "ilike", `%${q}%`),
    ]));
    return query;
  }

  const [{ count }, rows] = await Promise.all([
    buildQuery().select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
    buildQuery()
      .select([
      "vip_subscriptions.id",
      "vip_subscriptions.status",
      "vip_subscriptions.price",
      "vip_subscriptions.starts_at",
      "vip_subscriptions.ends_at",
      "vip_subscriptions.admin_note",
      "vip_subscriptions.created_at",
      "payment_orders.status as payment_status",
      "payment_orders.ref_id as payment_ref_id",
      "payment_orders.card_pan as payment_card_pan",
      "payment_orders.paid_at",
      "users.name as user_name",
      "users.phone as user_phone",
      "vip_plans.title as plan_title",
      ])
      .orderBy("vip_subscriptions.created_at", "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
  ]);
  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  return (
    <>
      <div className="admin-page-header">
        <p style={{ marginBottom: 4 }}>
          <Link href="/admin/vip-plans">← بازگشت به پلن‌های VIP</Link>
        </p>
        <h1>اشتراک‌های VIP</h1>
        <p>{Number(count).toLocaleString("fa-IR")} اشتراک مطابق فیلترهای فعلی. سفارش پرداخت‌شده به‌صورت خودکار فعال می‌شود.</p>
      </div>

      <form method="get" className="admin-filters">
        <input name="q" defaultValue={q ?? ""} placeholder="نام، موبایل یا پلن" aria-label="جست‌وجوی اشتراک" />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">همهٔ وضعیت‌ها</option>
          {VIP_SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {VIP_SUBSCRIPTION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="paymentStatus" defaultValue={paymentStatus ?? ""}>
          <option value="">همهٔ وضعیت‌های پرداخت</option>
          <option value="pending">در انتظار پرداخت</option>
          <option value="paid">پرداخت‌شده</option>
          <option value="failed">ناموفق</option>
          <option value="expired">منقضی‌شده</option>
        </select>
        <button className="btn-primary" type="submit">
          اعمال فیلتر
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>پلن</th>
              <th>قیمت</th>
              <th>پرداخت</th>
              <th>وضعیت اشتراک</th>
              <th>تاریخ درخواست</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.user_name}
                  <br />
                  <span style={{ color: "#666" }}>{s.user_phone}</span>
                </td>
                <td>{s.plan_title}</td>
                <td>{formatToman(Number(s.price))}</td>
                <td>
                  {s.payment_status === "paid" ? (
                    <>
                      <span className="status-badge status-badge--active">پرداخت‌شده</span>
                      {s.payment_ref_id && <><br /><span style={{ color: "#666", fontSize: "0.85rem" }}>شماره پیگیری: {s.payment_ref_id}</span></>}
                      {s.payment_card_pan && <><br /><span style={{ color: "#666", fontSize: "0.85rem" }}>کارت: {s.payment_card_pan}</span></>}
                      {s.paid_at && <><br /><span style={{ color: "#666", fontSize: "0.85rem" }}>{new Date(s.paid_at).toLocaleDateString("fa-IR")}</span></>}
                    </>
                  ) : s.payment_status === "failed" ? (
                    <span className="status-badge status-badge--rejected">ناموفق</span>
                  ) : s.payment_status === "expired" ? (
                    <span className="status-badge">منقضی‌شده</span>
                  ) : (
                    <span className="status-badge status-badge--pending">در انتظار پرداخت</span>
                  )}
                </td>
                <td>
                  <span className={`status-badge status-badge--${s.status}`}>
                    {VIP_SUBSCRIPTION_STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  {s.admin_note && s.status === "rejected" && (
                    <>
                      <br />
                      <span style={{ color: "#991b1b", fontSize: "0.85rem" }}>{s.admin_note}</span>
                    </>
                  )}
                </td>
                <td>{new Date(s.created_at).toLocaleDateString("fa-IR")}</td>
                <td>
                  <AdminVipSubscriptionActions subscriptionId={s.id} status={s.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="search-empty">
                  درخواستی یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination basePath="/admin/vip-plans/subscriptions" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Heart, Inbox, MessageCircle, type LucideIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import AccountProfileForm from "@/components/AccountProfileForm";

// صفحهٔ مرکزی حساب کاربری — نمای کلی (تعداد آگهی/علاقه‌مندی/درخواست/گفتگو) + فرم ویرایش پروفایل.
// همان زبان بصری داشبورد مدیریت (کارت‌های آماری) برای یکدست بودن ظاهر همهٔ پنل‌ها.

function KpiIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="kpi-card__icon">
      <Icon size={18} />
    </span>
  );
}

async function countRows(table: "advertisements" | "favorites", col: string, val: number): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where(col as never, "=", val as never)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [adsCount, favoritesCount, requestsCount, threadsCount, rejectedAds, unreadMessages, unpaidSubscription] = await Promise.all([
    countRows("advertisements", "created_by_user_id", user.id),
    countRows("favorites", "user_id", user.id),
    db
      .selectFrom("advertisement_inquiries")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where((eb) => eb.or([eb("owner_user_id", "=", user.id), eb("user_id", "=", user.id)]))
      .executeTakeFirst()
      .then((r) => Number(r?.count ?? 0)),
    db
      .selectFrom("chat_threads")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where((eb) => eb.or([eb("buyer_user_id", "=", user.id), eb("seller_user_id", "=", user.id)]))
      .executeTakeFirst()
      .then((r) => Number(r?.count ?? 0)),
    db
      .selectFrom("advertisements")
      .select(["id", "title"])
      .where("created_by_user_id", "=", user.id)
      .where("status", "=", "rejected")
      .orderBy("updated_at", "desc")
      .limit(3)
      .execute(),
    db
      .selectFrom("chat_threads")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where((eb) =>
        eb.or([
          eb.and([
            eb("buyer_user_id", "=", user.id),
            eb.or([
              eb("buyer_last_read_at", "is", null),
              eb("last_message_at", ">", eb.ref("buyer_last_read_at")),
            ]),
          ]),
          eb.and([
            eb("seller_user_id", "=", user.id),
            eb.or([
              eb("seller_last_read_at", "is", null),
              eb("last_message_at", ">", eb.ref("seller_last_read_at")),
            ]),
          ]),
        ]),
      )
      .executeTakeFirst()
      .then((r) => Number(r?.count ?? 0)),
    db
      .selectFrom("vip_subscriptions")
      .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id")
      .select(["vip_subscriptions.id", "vip_subscriptions.status", "vip_plans.title as plan_title"])
      .where("vip_subscriptions.user_id", "=", user.id)
      .where("vip_subscriptions.status", "=", "awaiting_payment")
      .orderBy("vip_subscriptions.created_at", "desc")
      .executeTakeFirst(),
  ]);

  return (
    <>
      <div className="dashboard-page-header">
        <h1>خوش آمدید، {user.name}</h1>
        <p>نمای کلی فعالیت شما در لوکیشن ساری.</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <KpiIcon icon={Megaphone} />
          <p className="kpi-card__label">آگهی‌های من</p>
          <p className="kpi-card__value">{adsCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <KpiIcon icon={Heart} />
          <p className="kpi-card__label">علاقه‌مندی‌ها</p>
          <p className="kpi-card__value">{favoritesCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <KpiIcon icon={Inbox} />
          <p className="kpi-card__label">درخواست‌های من</p>
          <p className="kpi-card__value">{requestsCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="kpi-card">
          <KpiIcon icon={MessageCircle} />
          <p className="kpi-card__label">گفتگوهای من</p>
          <p className="kpi-card__value">{threadsCount.toLocaleString("fa-IR")}</p>
        </div>
      </div>

      <div className="admin-quick-actions">
        <Link href="/account/advertisements/new">+ ثبت آگهی جدید</Link>
        <Link href="/account/advertisements">آگهی‌های من</Link>
        <Link href="/account/vip">آگهی VIP</Link>
        <Link href="/account/agency">آژانس من</Link>
        <Link href="/account/consultant">پروفایل مشاور</Link>
      </div>

      {(rejectedAds.length > 0 || unreadMessages > 0 || unpaidSubscription) && (
        <section className="form-section account-attention">
          <h2>نیازمند توجه شما</h2>
          {unreadMessages > 0 && (
            <p><Link href="/account/messages">{unreadMessages.toLocaleString("fa-IR")} گفتگوی دارای پیام جدید را مشاهده کنید.</Link></p>
          )}
          {unpaidSubscription && (
            <p><Link href="/account/vip">پرداخت اشتراک «{unpaidSubscription.plan_title}» هنوز تکمیل نشده است.</Link></p>
          )}
          {rejectedAds.map((ad) => (
            <p key={ad.id}><Link href={`/account/advertisements/${ad.id}/edit`}>آگهی «{ad.title}» رد شده و نیاز به اصلاح دارد.</Link></p>
          ))}
        </section>
      )}

      <div className="account-page-header">
        <h2>ویرایش پروفایل</h2>
      </div>
      <div className="account-form">
        <AccountProfileForm initialName={user.name} phone={user.phone} />
      </div>
    </>
  );
}

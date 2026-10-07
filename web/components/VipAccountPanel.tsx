"use client";

// پنل حساب کاربری برای آگهی VIP — خرید اشتراک (تأیید دستی ادمین) + فعال/غیرفعال‌سازی نمایش VIP روی آگهی‌های خودِ کاربر.

import { useEffect, useState } from "react";
import Link from "next/link";
import { VIP_SUBSCRIPTION_STATUS_LABELS, formatToman } from "@/lib/labels";

interface Plan {
  id: number;
  title: string;
  description: string | null;
  price: number;
  ad_limit: number;
  discount_percent: number;
  final_price: number;
}
interface Subscription {
  id: number;
  status: string;
  price: number;
  ad_limit: number;
  agency_id: number | null;
  starts_at: string | null;
  ends_at: string | null;
  admin_note: string | null;
  created_at: string;
  plan_title: string;
}
interface AdItem {
  id: number;
  title: string;
  slug: string;
  status: string;
  is_vip: boolean;
  vip_expires_at: string | null;
}

export default function VipAccountPanel({ initialAds, isAgencyMember }: { initialAds: AdItem[]; isAgencyMember: boolean }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<number | null>(null);
  const [ads, setAds] = useState<AdItem[]>(initialAds);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [togglingAdId, setTogglingAdId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    Promise.all([
      fetch("/api/vip/plans", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { plans: [] })),
      fetch("/api/account/vip-subscriptions").then((r) => (r.ok ? r.json() : { subscriptions: [], activeSubscriptionId: null })),
    ])
      .then(([plansData, subsData]) => {
        setPlans(plansData.plans ?? []);
        setSubscriptions(subsData.subscriptions ?? []);
        setActiveSubscriptionId(subsData.activeSubscriptionId ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const hasPending = subscriptions.some((s) => s.status === "awaiting_payment");
  const activeSubscription = subscriptions.find((s) => s.id === activeSubscriptionId) ?? null;

  async function requestPlan(planId: number) {
    setError("");
    setNotice("");
    setRequesting(planId);
    try {
      const res = await fetch("/api/account/vip-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت درخواست");
      window.location.assign(data.redirectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت درخواست");
    } finally {
      setRequesting(null);
    }
  }

  async function toggleAdVip(adId: number, enable: boolean) {
    setError("");
    setTogglingAdId(adId);
    try {
      const res = await fetch(`/api/account/advertisements/${adId}/vip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در انجام عملیات");
      setAds((prev) =>
        prev.map((a) => (a.id === adId ? { ...a, is_vip: data.advertisement.is_vip, vip_expires_at: data.advertisement.vip_expires_at } : a))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در انجام عملیات");
    } finally {
      setTogglingAdId(null);
    }
  }

  if (loading) return <p>در حال بارگذاری…</p>;

  return (
    <>
      <div className="form-section">
        <h2>وضعیت اشتراک VIP من</h2>
        {activeSubscription ? (
          <p>
            <span className="status-badge status-badge--active">فعال</span> — پلن «{activeSubscription.plan_title}»
          </p>
        ) : (
          <p className="search-empty">در حال حاضر اشتراک VIP فعالی ندارید. برای نمایش ویژهٔ آگهی‌هایتان، یکی از پلن‌های زیر را خریداری کنید.</p>
        )}

        {subscriptions.length > 0 && (
          <div className="admin-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>پلن</th>
                  <th>قیمت</th>
                  <th>سقف آگهی</th>
                  <th>وضعیت</th>
                  <th>تاریخ درخواست</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.plan_title}</td>
                    <td>{formatToman(s.price)}</td>
                    <td>{s.ad_limit.toLocaleString("fa-IR")}</td>
                    <td>
                      <span className={`status-badge status-badge--${s.status}`}>{VIP_SUBSCRIPTION_STATUS_LABELS[s.status] ?? s.status}</span>
                      {s.status === "rejected" && s.admin_note && (
                        <>
                          <br />
                          <span style={{ color: "#991b1b", fontSize: "0.85rem" }}>{s.admin_note}</span>
                        </>
                      )}
                    </td>
                    <td>{new Date(s.created_at).toLocaleDateString("fa-IR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>پلن‌های اشتراک</h2>
        {error && <div className="error-box">{error}</div>}
        {notice && <div className="success-box">{notice}</div>}
        {!isAgencyMember && <p className="search-empty">خرید اشتراک VIP فقط برای اعضای فعال آژانس‌ها امکان‌پذیر است.</p>}
        {hasPending && <p className="search-empty">یک سفارش در انتظار پرداخت دارید؛ با کلیک روی درخواست خرید، پرداخت همان سفارش ادامه پیدا می‌کند.</p>}
        <div className="my-ads-list">
          {plans.map((p) => (
            <div key={p.id} className="my-ad-row">
              <div className="my-ad-row__body">
                <div className="my-ad-row__title-line">
                  <h3>{p.title}</h3>
                  <span>
                    {p.discount_percent > 0 && <del style={{ color: "#777", marginLeft: 8 }}>{formatToman(p.price)}</del>}
                    {formatToman(p.final_price)}
                  </span>
                </div>
                {p.description && <p className="my-ad-row__meta">{p.description}</p>}
                <p className="my-ad-row__meta">سقف {p.ad_limit.toLocaleString("fa-IR")} آگهی VIP</p>
                {p.discount_percent > 0 && <p className="my-ad-row__meta">تخفیف: {p.discount_percent.toLocaleString("fa-IR")}٪</p>}
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!isAgencyMember || requesting === p.id}
                  onClick={() => requestPlan(p.id)}
                >
                  {requesting === p.id ? "در حال ارسال…" : "درخواست خرید"}
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && <p className="search-empty">در حال حاضر پلنی برای فروش فعال نیست.</p>}
        </div>
      </div>

      <div className="form-section">
        <h2>فعال‌سازی VIP روی آگهی‌های من</h2>
        {!activeSubscription && <p className="search-empty">برای فعال‌سازی نمایش VIP روی آگهی‌هایتان، ابتدا باید یک اشتراک فعال داشته باشید.</p>}
        {ads.length === 0 ? (
          <p className="search-empty">
            آگهی‌ای ثبت نکرده‌اید. <Link href="/account/advertisements/new">ثبت آگهی جدید</Link>
          </p>
        ) : (
          <div className="my-ads-list">
            {ads.map((ad) => (
              <div key={ad.id} className="my-ad-row">
                <div className="my-ad-row__body">
                  <div className="my-ad-row__title-line">
                    <h3>{ad.title}</h3>
                    {ad.is_vip ? (
                      <span className="status-badge status-badge--active">
                        VIP تا {ad.vip_expires_at ? new Date(ad.vip_expires_at).toLocaleDateString("fa-IR") : "—"}
                      </span>
                    ) : (
                      <span className="status-badge status-badge--suspended">عادی</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={ad.is_vip ? "btn-danger" : "btn-primary"}
                    disabled={togglingAdId === ad.id || (!ad.is_vip && !activeSubscription)}
                    onClick={() => toggleAdVip(ad.id, !ad.is_vip)}
                  >
                    {togglingAdId === ad.id ? "در حال اعمال…" : ad.is_vip ? "غیرفعال‌سازی VIP" : "فعال‌سازی VIP"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

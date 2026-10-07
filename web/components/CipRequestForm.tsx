"use client";

import { useState } from "react";

type Plan = { id: number; title: string; price: number };
type Advertisement = { id: number; title: string };

export default function CipRequestForm({ plans, advertisements, selectedPlanId, selectedAdvertisementId }: { plans: Plan[]; advertisements: Advertisement[]; selectedPlanId?: number; selectedAdvertisementId?: number }) {
  const [planId, setPlanId] = useState(String(selectedPlanId ?? plans[0]?.id ?? ""));
  const [advertisementId, setAdvertisementId] = useState(String(selectedAdvertisementId ?? ""));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/account/cip-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, advertisementId }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "خطا در ثبت سفارش؛ لطفاً دوباره تلاش کنید");
      window.location.assign(data.redirectUrl);
    } catch (err) { setError(err instanceof Error ? err.message : "خطا در ثبت سفارش"); } finally { setSubmitting(false); }
  }
  if (!plans.length) return <p className="search-empty">در حال حاضر پلن فعالی برای CIP وجود ندارد.</p>;
  return <form className="form-section" onSubmit={submit}>
    <h2>ثبت سفارش ویدیوی CIP</h2>
    {error && <p className="my-ad__error">{error}</p>}
    <div className="form-group"><label>پلن ویدیو</label><select value={planId} onChange={(e) => setPlanId(e.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} — {plan.price.toLocaleString("fa-IR")} تومان</option>)}</select></div>
    {advertisements.length ? <div className="form-group"><label>آگهی ملک</label><select required value={advertisementId} onChange={(e) => setAdvertisementId(e.target.value)}><option value="">انتخاب آگهی</option>{advertisements.map((ad) => <option key={ad.id} value={ad.id}>{ad.title}</option>)}</select></div> : <p className="form-hint">هنوز آگهی‌ای برای انتخاب ندارید.</p>}
    <a className="btn-secondary" href={`/account/advertisements/new?cipPlan=${planId}`}>ثبت مشخصات ملک جدید برای CIP</a>
    <small>پس از پرداخت، تیم مدیریت برای هماهنگی تصویربرداری با شما تماس می‌گیرد.</small>
    <button className="btn-primary" disabled={submitting || !advertisementId}>{submitting ? "در حال انتقال به پرداخت..." : "پرداخت و ثبت درخواست"}</button>
  </form>;
}

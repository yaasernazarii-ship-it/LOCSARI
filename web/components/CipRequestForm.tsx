"use client";

import { useState } from "react";

type Plan = { id: number; title: string; price: number };
type Advertisement = { id: number; title: string };

export default function CipRequestForm({
  plans,
  advertisements,
  selectedPlanId,
  selectedAdvertisementId,
  contractTitle,
  contractText,
}: {
  plans: Plan[];
  advertisements: Advertisement[];
  selectedPlanId?: number;
  selectedAdvertisementId?: number;
  contractTitle: string;
  contractText: string;
}) {
  const [planId, setPlanId] = useState(String(selectedPlanId ?? plans[0]?.id ?? ""));
  const [advertisementId, setAdvertisementId] = useState(String(selectedAdvertisementId ?? ""));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [contractOpen, setContractOpen] = useState(false);
  const [contractRead, setContractRead] = useState(false);
  const [codeSentPhone, setCodeSentPhone] = useState("");
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [contractTicket, setContractTicket] = useState("");
  const [stepError, setStepError] = useState("");

  async function sendCode() {
    setSendingCode(true);
    setStepError("");
    try {
      const response = await fetch("/api/account/cip-contract/send", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "ارسال کد پیامک ناموفق بود");
      setCodeSentPhone(data.phone);
      setContractTicket("");
      setCode("");
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "ارسال کد پیامک ناموفق بود");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyCode() {
    setVerifying(true);
    setStepError("");
    try {
      const response = await fetch("/api/account/cip-contract/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ticket) throw new Error(data?.error || "کد تأیید نادرست است");
      setContractTicket(data.ticket);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "کد تأیید نادرست است");
    } finally {
      setVerifying(false);
    }
  }

  function closeContract() {
    setContractOpen(false);
    setContractRead(false);
    setCodeSentPhone("");
    setContractTicket("");
    setCode("");
    setStepError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!contractTicket) {
      setError("برای پرداخت، ابتدا قرارداد را تأیید کنید.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/account/cip-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, advertisementId, contractTicket }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "خطا در ثبت سفارش؛ لطفاً دوباره تلاش کنید");
      window.location.assign(data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  }

  if (!plans.length) return <p className="search-empty">در حال حاضر پلن فعالی برای CIP وجود ندارد.</p>;

  return (
    <form className="form-section" onSubmit={submit}>
      <h2>ثبت سفارش ویدیوی CIP</h2>
      {error && <p className="my-ad__error">{error}</p>}
      <div className="form-group">
        <label>پلن ویدیو</label>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title} — {plan.price.toLocaleString("fa-IR")} تومان
            </option>
          ))}
        </select>
      </div>
      {advertisements.length ? (
        <div className="form-group">
          <label>آگهی ملک</label>
          <select required value={advertisementId} onChange={(e) => setAdvertisementId(e.target.value)}>
            <option value="">انتخاب آگهی</option>
            {advertisements.map((ad) => (
              <option key={ad.id} value={ad.id}>
                {ad.title}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="form-hint">هنوز آگهی‌ای برای انتخاب ندارید.</p>
      )}
      <a className="btn-secondary" href={`/account/advertisements/new?cipPlan=${planId}`}>
        ثبت مشخصات ملک جدید برای CIP
      </a>

      <div className={`cip-contract${contractTicket ? " cip-contract--confirmed" : ""}`}>
        <div className="cip-contract__header">
          <strong>{contractTitle}</strong>
          {contractTicket && <span className="status-badge status-badge--approved">تأییدشده</span>}
        </div>
        {!contractOpen && !contractTicket && (
          <>
            <p className="form-hint">پیش از پرداخت، متن قرارداد را بخوانید و با کد پیامک تأیید کنید.</p>
            <button type="button" className="btn-secondary" onClick={() => setContractOpen(true)}>
              مطالعهٔ قرارداد و تأیید
            </button>
          </>
        )}
        {contractOpen && !contractTicket && (
          <div className="cip-contract__panel">
            <div className="cip-contract__text" tabIndex={0}>
              {contractText.split(/\r?\n/).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            <label className="form-group--checkbox cip-contract__read">
              <input type="checkbox" checked={contractRead} onChange={(e) => setContractRead(e.target.checked)} />
              قرارداد را مطالعه کردم و شرایط آن را می‌پذیرم.
            </label>

            {!codeSentPhone ? (
              <button
                type="button"
                className="btn-primary"
                disabled={!contractRead || sendingCode}
                onClick={sendCode}
              >
                {sendingCode ? "در حال ارسال کد…" : "ارسال کد تأیید به شمارهٔ من"}
              </button>
            ) : (
              <div className="cip-contract__otp">
                <p className="form-hint">کد ۵ رقمی به شمارهٔ {codeSentPhone} ارسال شد.</p>
                <div className="cip-contract__otp-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={5}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))}
                    placeholder="کد تأیید"
                  />
                  <button type="button" className="btn-primary" disabled={code.length !== 5 || verifying} onClick={verifyCode}>
                    {verifying ? "در حال بررسی…" : "تأیید کد"}
                  </button>
                </div>
                <button type="button" className="cip-contract__resend" disabled={sendingCode} onClick={sendCode}>
                  {sendingCode ? "در حال ارسال…" : "دریافت کد جدید"}
                </button>
              </div>
            )}
            {stepError && <p className="my-ad__error">{stepError}</p>}
            <button type="button" className="cip-contract__cancel" onClick={closeContract}>
              انصراف
            </button>
          </div>
        )}
      </div>

      <small>پس از پرداخت، تیم مدیریت برای هماهنگی تصویربرداری با شما تماس می‌گیرد.</small>
      <button className="btn-primary" disabled={submitting || !advertisementId || !contractTicket} type="submit">
        {submitting ? "در حال انتقال به پرداخت..." : contractTicket ? "پرداخت و ثبت درخواست" : "ابتدا قرارداد را تأیید کنید"}
      </button>
    </form>
  );
}

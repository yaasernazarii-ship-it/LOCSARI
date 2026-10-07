"use client";

// جعبهٔ تماس با آگهی‌دهنده (فاز ۵.۱ «Contact & Viewing Request Inbox») — نمایش شماره پس از کلیک
// + دو دکمهٔ مجزا «درخواست تماس» و «درخواست بازدید». ثبت درخواست فقط برای کاربر واردشده مجاز است؛
// کاربر مهمان به صفحهٔ ورود با بازگشت به همین آگهی هدایت می‌شود (بخش ۵ پرامپت).

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestType = "contact" | "viewing_request";

export default function ContactBox({
  advertisementId,
  slug,
  isLoggedIn,
}: {
  advertisementId: number;
  slug: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState("");

  const [openType, setOpenType] = useState<RequestType | null>(null);
  const [message, setMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState<RequestType | null>(null);

  async function revealContact() {
    if (contact || contactLoading) return;
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/agahi/${slug}`)}`);
      return;
    }
    setContactLoading(true);
    setContactError("");
    try {
      const res = await fetch(`/api/advertisements/${advertisementId}/contact`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در دریافت اطلاعات تماس");
      setContact({ name: data.name, phone: data.phone });
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات تماس");
    } finally {
      setContactLoading(false);
    }
  }

  function openRequestForm(type: RequestType) {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/agahi/${slug}`)}`);
      return;
    }
    setSubmitError("");
    setOpenType(type);
  }

  async function submitRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openType) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertisementId,
          type: openType,
          message: message || undefined,
          preferredDate: openType === "viewing_request" ? preferredDate : undefined,
          preferredTime: openType === "viewing_request" ? preferredTime || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت درخواست");
      setSubmitted(openType);
      setOpenType(null);
      setMessage("");
      setPreferredDate("");
      setPreferredTime("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "خطا در ثبت درخواست");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="contact-box">
      <h2>تماس با آگهی‌دهنده</h2>

      {contact ? (
        <p className="contact-box__phone">
          {contact.name}: <a href={`tel:${contact.phone}`}>{contact.phone}</a>
        </p>
      ) : (
        <button type="button" className="btn-primary" onClick={revealContact} disabled={contactLoading}>
          {contactLoading ? "در حال دریافت…" : isLoggedIn ? "نمایش شمارهٔ تماس" : "ورود برای نمایش شمارهٔ تماس"}
        </button>
      )}
      {contactError && <div className="error-box">{contactError}</div>}

      {submitted && (
        <div className="success-box">
          {submitted === "contact" ? "درخواست تماس شما ثبت شد" : "درخواست بازدید شما ثبت شد"}؛ آگهی‌دهنده به‌زودی با شما تماس می‌گیرد.
        </div>
      )}

      {!openType && (
        <div className="contact-box__buttons">
          <button type="button" className="btn-secondary" onClick={() => openRequestForm("contact")}>
            درخواست تماس
          </button>
          <button type="button" className="btn-secondary" onClick={() => openRequestForm("viewing_request")}>
            درخواست بازدید
          </button>
        </div>
      )}

      {openType && (
        <form className="contact-box__form" onSubmit={submitRequest}>
          {openType === "viewing_request" && (
            <div className="form-grid">
              <div className="form-group">
                <label>تاریخ پیشنهادی بازدید *</label>
                <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>ساعت پیشنهادی</label>
                <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
              </div>
            </div>
          )}
          <div className="form-group">
            <label>پیام (اختیاری)</label>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {submitError && <div className="error-box">{submitError}</div>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "در حال ارسال…" : "ارسال درخواست"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpenType(null)}>
              انصراف
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

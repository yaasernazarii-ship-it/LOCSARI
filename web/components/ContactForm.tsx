"use client";

// فرم عمومی «تماس با ما» — بدون نیاز به ورود؛ پیام در contact_messages ذخیره و در پنل مدیریت قابل مشاهده است.

import { useState } from "react";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email: email || undefined, subject: subject || undefined, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ارسال پیام");
      setSubmitted(true);
      setName("");
      setPhone("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ارسال پیام");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="success-box">
        پیام شما با موفقیت ثبت شد. تیم پشتیبانی لوکیشن ساری در اسرع وقت با شما تماس می‌گیرد.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="contact-form">
      <div className="form-group">
        <label>نام و نام خانوادگی *</label>
        <input type="text" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>شماره موبایل *</label>
          <input type="tel" value={phone} pattern="09[0-9]{9}" placeholder="09xxxxxxxxx" onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>ایمیل (اختیاری)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label>موضوع (اختیاری)</label>
        <input type="text" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="form-group">
        <label>پیام شما *</label>
        <textarea rows={5} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} required />
      </div>

      {error && <div className="error-box">{error}</div>}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "در حال ارسال..." : "ارسال پیام"}
      </button>
    </form>
  );
}

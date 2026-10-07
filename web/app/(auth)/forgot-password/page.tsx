"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// بازیابی رمز عبور با OTP (فاز ۱.۲) — فقط برای حساب‌های مبتنی بر رمز عبور (پنل مدیریت).
// شماره موبایل → کد تأیید + رمز عبور جدید → بازگشت به صفحهٔ ورود پنل مدیریت
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    const form = new FormData(e.currentTarget);
    const value = String(form.get("phone") || "").trim();
    setLoading(true);
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: value, purpose: "password_reset" }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "خطا در ارسال کد تأیید");
      return;
    }
    setPhone(value);
    setStep("reset");
    // پیام عمداً کلی است؛ چون سرور برای شماره‌های بدون حساب هم همین پاسخ را برمی‌گرداند (جلوگیری از افشای وجود حساب)
    setInfo("اگر این شماره در سامانه ثبت شده باشد، کد تأیید برایش پیامک می‌شود.");
  }

  async function onReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") || "").trim();
    const password = String(form.get("password") || "");

    setLoading(true);
    const verifyRes = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "password_reset", code }),
    });
    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      setLoading(false);
      setError(verifyData.error || "کد تأیید نامعتبر است");
      return;
    }

    const res = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password, otpTicket: verifyData.ticket }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "خطا در تغییر رمز عبور");
      return;
    }
    router.push("/admin-login");
  }

  async function onResend() {
    setError("");
    setInfo("");
    setLoading(true);
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "password_reset" }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "خطا در ارسال مجدد کد");
      return;
    }
    setInfo("اگر این شماره در سامانه ثبت شده باشد، کد تأیید مجدداً پیامک می‌شود.");
  }

  return (
    <div className="auth-page">
      <h1>بازیابی رمز عبور</h1>
      {error && <div className="error-box">{error}</div>}
      {info && <div className="success-box">{info}</div>}

      {step === "phone" ? (
        <form onSubmit={onSendCode}>
          <div className="form-group">
            <label>شماره موبایل</label>
            <input type="tel" name="phone" pattern="09[0-9]{9}" placeholder="09xxxxxxxxx" required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "در حال ارسال..." : "دریافت کد تأیید"}
          </button>
        </form>
      ) : (
        <form onSubmit={onReset}>
          <div className="form-group">
            <label>کد تأیید ارسال‌شده به {phone}</label>
            <input type="text" name="code" inputMode="numeric" autoFocus required />
          </div>
          <div className="form-group">
            <label>رمز عبور جدید (حداقل ۶ کاراکتر)</label>
            <input type="password" name="password" minLength={6} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "در حال ثبت..." : "تغییر رمز عبور"}
          </button>
          <button type="button" className="btn-secondary" onClick={onResend} disabled={loading}>
            ارسال مجدد کد
          </button>
        </form>
      )}
    </div>
  );
}

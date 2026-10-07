"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// اگر با ?next=/agahi/... به این صفحه هدایت شده باشیم (مثلاً از دکمهٔ درخواست تماس/بازدید برای کاربر مهمان)،
// بعد از ورود موفق به همان صفحه برمی‌گردیم؛ فقط مسیرهای نسبی داخلی پذیرفته می‌شوند (بدون open-redirect).
function useNextPath(): string {
  const [nextPath, setNextPath] = useState("/account");
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) setNextPath(raw);
  }, []);
  return nextPath;
}

const OTP_LOGIN_DISABLED = false;

// ورود/ثبت‌نام کاربر عادی فقط با کد پیامکی (فاز ۱.۲) — بدون رمز عبور.
// اگر شماره قبلاً ثبت‌نام نشده باشد، سرور بعد از تأیید کد نام را می‌خواهد و همان‌جا حساب ساخته می‌شود.
export default function LoginPage() {
  const router = useRouter();
  const nextPath = useNextPath();
  const [step, setStep] = useState<"phone" | "code" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function finishLogin(otpTicket: string, name?: string) {
    const res = await fetch("/api/auth/login/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otpTicket, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "خطا در ورود");
      return;
    }
    if (data.needName) {
      setTicket(otpTicket);
      setStep("name");
      return;
    }
    router.push(nextPath);
  }

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
      body: JSON.stringify({ phone: value, purpose: "login" }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "خطا در ارسال کد تأیید");
      return;
    }
    setPhone(value);
    setStep("code");
    setInfo("کد تأیید برای شما پیامک شد.");
  }

  async function onVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") || "").trim();

    setLoading(true);
    const verifyRes = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "login", code }),
    });
    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      setLoading(false);
      setError(verifyData.error || "کد تأیید نامعتبر است");
      return;
    }
    await finishLogin(verifyData.ticket);
    setLoading(false);
  }

  async function onSubmitName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    setLoading(true);
    await finishLogin(ticket, name);
    setLoading(false);
  }

  async function onResend() {
    setError("");
    setInfo("");
    setLoading(true);
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "login" }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "خطا در ارسال مجدد کد");
      return;
    }
    setInfo("کد تأیید مجدداً پیامک شد.");
  }

  if (OTP_LOGIN_DISABLED) {
    return (
      <div className="auth-page">
        <h1>ورود / ثبت‌نام</h1>
        <div className="error-box">ورود با کد پیامکی موقتاً غیرفعال است. لطفاً بعداً دوباره تلاش کنید.</div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>ورود / ثبت‌نام</h1>
      {error && <div className="error-box">{error}</div>}
      {info && <div className="success-box">{info}</div>}

      {step === "phone" && (
        <form onSubmit={onSendCode}>
          <div className="form-group">
            <label>شماره موبایل</label>
            <input type="tel" name="phone" pattern="09[0-9]{9}" placeholder="09xxxxxxxxx" required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "در حال ارسال..." : "دریافت کد تأیید"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={onVerifyCode}>
          <div className="form-group">
            <label>کد تأیید ارسال‌شده به {phone}</label>
            <input type="text" name="code" inputMode="numeric" autoFocus required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "در حال بررسی..." : "ورود"}
          </button>
          <button type="button" className="btn-secondary" onClick={onResend} disabled={loading}>
            ارسال مجدد کد
          </button>
        </form>
      )}

      {step === "name" && (
        <form onSubmit={onSubmitName}>
          <div className="form-group">
            <label>این شماره جدید است — نام و نام خانوادگی</label>
            <input type="text" name="name" autoFocus required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "در حال ثبت‌نام..." : "تکمیل ثبت‌نام"}
          </button>
        </form>
      )}
    </div>
  );
}

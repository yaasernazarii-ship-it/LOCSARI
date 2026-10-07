"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ورود به پنل مدیریت سایت — فقط با رمز عبور (جدا از ورود پیامکی کاربران عادی در /login).
export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: form.get("phone"),
        password: form.get("password"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "خطا در ورود");
      return;
    }
    router.push("/admin");
  }

  return (
    <div className="auth-page">
      <h1>ورود به پنل مدیریت</h1>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label>شماره موبایل</label>
          <input type="tel" name="phone" pattern="09[0-9]{9}" placeholder="09xxxxxxxxx" required />
        </div>
        <div className="form-group">
          <label>رمز عبور</label>
          <input type="password" name="password" required />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "در حال ورود..." : "ورود"}
        </button>
      </form>
      <div className="form-group" style={{ textAlign: "center", marginTop: 4 }}>
        <a href="/forgot-password">رمز عبور را فراموش کرده‌اید؟</a>
      </div>
    </div>
  );
}

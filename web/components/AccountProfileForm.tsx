"use client";

// فرم ویرایش نام و تغییر رمز عبور — شمارهٔ موبایل (شناسهٔ ورود) قابل تغییر نیست.

import { useState } from "react";

export default function AccountProfileForm({ initialName, phone }: { initialName: string; phone: string }) {
  const [name, setName] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameNotice, setNameNotice] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError("");
    setNameNotice("");
    if (!name.trim()) return setNameError("نام نمی‌تواند خالی باشد");
    setNameSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیرهٔ نام");
      setNameNotice("نام با موفقیت ذخیره شد.");
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "خطا در ذخیرهٔ نام");
    } finally {
      setNameSaving(false);
    }
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError("");
    setPasswordNotice("");
    if (newPassword.length < 6) return setPasswordError("رمز عبور جدید باید حداقل ۶ کاراکتر باشد");
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در تغییر رمز عبور");
      setPasswordNotice("رمز عبور با موفقیت تغییر کرد.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "خطا در تغییر رمز عبور");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <>
      <div className="form-section">
        <h2>اطلاعات حساب</h2>
        <form onSubmit={saveName}>
          <div className="form-group">
            <label>شماره موبایل</label>
            <input type="text" value={phone} disabled />
            <small>شماره موبایل قابل تغییر نیست.</small>
          </div>
          <div className="form-group">
            <label>نام</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {nameError && <div className="error-box">{nameError}</div>}
          {nameNotice && <div className="success-box">{nameNotice}</div>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={nameSaving}>
              {nameSaving ? "در حال ذخیره…" : "ذخیرهٔ نام"}
            </button>
          </div>
        </form>
      </div>

      <div className="form-section">
        <h2>تغییر رمز عبور</h2>
        <form onSubmit={savePassword}>
          <div className="form-group">
            <label>رمز عبور فعلی</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>رمز عبور جدید</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          {passwordError && <div className="error-box">{passwordError}</div>}
          {passwordNotice && <div className="success-box">{passwordNotice}</div>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={passwordSaving}>
              {passwordSaving ? "در حال ذخیره…" : "تغییر رمز عبور"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

"use client";

// فرم ثبت مستقیم مشاور توسط ادمین — شمارهٔ ورود مشاور را می‌گیرد؛ اگر کاربری با آن شماره وجود نداشته
// باشد همان‌جا ساخته می‌شود و پروفایل مشاور بلافاصله تأییدشده ثبت می‌شود (بدون نیاز به درخواست/تأیید).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";

interface AgencyOption {
  id: number;
  name: string;
}

export default function AdminConsultantCreateForm() {
  const router = useRouter();
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [form, setForm] = useState({
    loginPhone: "",
    userName: "",
    displayName: "",
    phone: "",
    bio: "",
    licenseNumber: "",
    agencyId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/agencies")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAgencies(d.agencies))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/consultants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginPhone: form.loginPhone.trim(),
          userName: form.userName.trim(),
          displayName: form.displayName.trim(),
          phone: form.phone.trim() || null,
          bio: form.bio.trim() || null,
          licenseNumber: form.licenseNumber.trim() || null,
          agencyId: form.agencyId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ثبت مشاور");
      showToast("مشاور با موفقیت ثبت شد", "success");
      router.push(`/admin/consultants/${data.consultant.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ثبت مشاور");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-section fade-in">
      <div className="form-group">
        <label>شمارهٔ ورود مشاور (موبایل) *</label>
        <input
          type="text"
          dir="ltr"
          placeholder="09xxxxxxxxx"
          value={form.loginPhone}
          onChange={(e) => setForm((f) => ({ ...f, loginPhone: e.target.value }))}
          required
        />
        <p className="field-hint">مشاور با همین شماره و کد پیامکی وارد حساب کاربری خود می‌شود.</p>
      </div>

      <div className="form-group">
        <label>نام کاربر (برای حساب ورود) *</label>
        <input type="text" value={form.userName} onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))} required />
      </div>

      <div className="form-group">
        <label>نام نمایشی مشاور *</label>
        <input type="text" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} required />
      </div>

      <div className="form-group">
        <label>توضیحات</label>
        <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>شمارهٔ تماس نمایشی (اختیاری)</label>
          <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <p className="field-hint">اگر خالی بماند همان شمارهٔ ورود نمایش داده می‌شود.</p>
        </div>
        <div className="form-group">
          <label>شمارهٔ پروانه</label>
          <input type="text" value={form.licenseNumber} onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))} />
        </div>
      </div>

      <div className="form-group">
        <label>آژانس (اختیاری)</label>
        <select value={form.agencyId} onChange={(e) => setForm((f) => ({ ...f, agencyId: e.target.value }))}>
          <option value="">بدون آژانس (مستقل)</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "در حال ثبت…" : "ثبت مشاور"}
        </button>
      </div>
    </form>
  );
}

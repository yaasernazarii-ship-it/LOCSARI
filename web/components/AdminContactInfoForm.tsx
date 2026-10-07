"use client";

// فرم ویرایش اطلاعات تماس سایت (آدرس، شماره تماس‌ها، شبکه‌های اجتماعی) — نمایش در صفحهٔ عمومی «تماس با ما»

import { useEffect, useState } from "react";
import { showToast } from "@/lib/adminToast";
import LocationPicker from "@/components/LocationPicker";

interface ContactInfo {
  address: string | null;
  phones: string[];
  telegram_url: string | null;
  instagram_url: string | null;
  eitaa_url: string | null;
  whatsapp_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

const EMPTY: ContactInfo = {
  address: "",
  phones: [],
  telegram_url: "",
  instagram_url: "",
  eitaa_url: "",
  whatsapp_url: "",
  latitude: null,
  longitude: null,
};

const MAX_PHONES = 10;

export default function AdminContactInfoForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ContactInfo>(EMPTY);

  useEffect(() => {
    fetch("/api/admin/settings/contact")
      .then((r) => r.json())
      .then((d) => {
        if (d.contact) {
          setForm({
            address: d.contact.address ?? "",
            phones: Array.isArray(d.contact.phones) ? d.contact.phones : [],
            telegram_url: d.contact.telegram_url ?? "",
            instagram_url: d.contact.instagram_url ?? "",
            eitaa_url: d.contact.eitaa_url ?? "",
            whatsapp_url: d.contact.whatsapp_url ?? "",
            latitude: d.contact.latitude ?? null,
            longitude: d.contact.longitude ?? null,
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ContactInfo>(key: K, value: ContactInfo[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setPhoneAt(index: number, value: string) {
    setForm((f) => {
      const phones = [...f.phones];
      phones[index] = value;
      return { ...f, phones };
    });
  }

  function addPhone() {
    setForm((f) => (f.phones.length >= MAX_PHONES ? f : { ...f, phones: [...f.phones, ""] }));
  }

  function removePhone(index: number) {
    setForm((f) => ({ ...f, phones: f.phones.filter((_, i) => i !== index) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره‌سازی");
      if (Array.isArray(data.contact?.phones)) set("phones", data.contact.phones);
      showToast("اطلاعات تماس ذخیره شد", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="search-empty">در حال بارگذاری...</p>;

  return (
    <form onSubmit={onSubmit} className="form-section fade-in">
      {error && <p className="my-ad__error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="form-group">
        <label>آدرس</label>
        <textarea rows={3} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="آدرس دفتر/شعبه" />
      </div>

      <LocationPicker
        latitude={form.latitude}
        longitude={form.longitude}
        onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
      />

      <div className="form-group">
        <label>شماره‌های تماس</label>
        {form.phones.map((phone, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhoneAt(i, e.target.value)}
              placeholder="011XXXXXXXX یا 09XXXXXXXXX"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn-secondary" style={{ width: "auto", flexShrink: 0 }} onClick={() => removePhone(i)}>
              حذف
            </button>
          </div>
        ))}
        {form.phones.length < MAX_PHONES && (
          <button type="button" className="btn-secondary" onClick={addPhone}>
            + افزودن شماره تماس
          </button>
        )}
        {form.phones.length === 0 && <p className="form-hint">هنوز شماره‌ای اضافه نشده است.</p>}
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>آیدی/لینک تلگرام</label>
          <input type="text" dir="ltr" value={form.telegram_url ?? ""} onChange={(e) => set("telegram_url", e.target.value)} placeholder="https://t.me/username" />
        </div>
        <div className="form-group">
          <label>آیدی/لینک اینستاگرام</label>
          <input type="text" dir="ltr" value={form.instagram_url ?? ""} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/username" />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>آیدی/لینک ایتا</label>
          <input type="text" dir="ltr" value={form.eitaa_url ?? ""} onChange={(e) => set("eitaa_url", e.target.value)} placeholder="https://eitaa.com/username" />
        </div>
        <div className="form-group">
          <label>لینک واتس‌اپ</label>
          <input type="text" dir="ltr" value={form.whatsapp_url ?? ""} onChange={(e) => set("whatsapp_url", e.target.value)} placeholder="https://wa.me/98912XXXXXXX" />
        </div>
      </div>

      <div className="admin-actions-bar">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>
    </form>
  );
}

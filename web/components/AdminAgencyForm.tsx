"use client";

// فرم مشترک ثبت/ویرایش آژانس از پنل مدیریت — ثبت با انتخاب مالک از میان کاربران ثبت‌نامی (با شماره موبایل)،
// ویرایش بدون تغییر مالک. از همان API های admin/agencies استفاده می‌کند.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";

interface SimpleLocation {
  id: number;
  name: string;
}

interface InitialAgency {
  name: string;
  description: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  neighborhoodId: number | null;
}

type Props = { mode: "create" } | { mode: "edit"; agencyId: number; initial: InitialAgency };

export default function AdminAgencyForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.initial : null;

  const [ownerPhone, setOwnerPhone] = useState("");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    phone: initial?.phone ?? "",
    mobile: initial?.mobile ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
    address: initial?.address ?? "",
    neighborhoodId: initial?.neighborhoodId ? String(initial.neighborhoodId) : "",
  });

  const [cityId, setCityId] = useState<number | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<SimpleLocation[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/locations/cities")
      .then((r) => r.json())
      .then((d) => {
        const sari = (d.cities ?? []).find((c: { slug: string }) => c.slug === "sari");
        if (!sari) return;
        setCityId(sari.id);
        fetch(`/api/locations/neighborhoods?cityId=${sari.id}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((dd) => setNeighborhoods(dd.neighborhoods ?? []))
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        cityId: cityId ?? undefined,
        districtId: null,
        marketZoneId: null,
        neighborhoodId: form.neighborhoodId ? Number(form.neighborhoodId) : null,
      };

      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/admin/agencies/${props.agencyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.ownerPhone = ownerPhone.trim();
        res = await fetch("/api/admin/agencies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیرهٔ آژانس");

      showToast(isEdit ? "تغییرات آژانس ذخیره شد" : "آژانس ثبت شد", "success");
      if (isEdit) {
        router.push(`/admin/agencies/${props.agencyId}`);
      } else {
        router.push(`/admin/agencies/${data.agency.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیرهٔ آژانس");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-section fade-in">
      {!isEdit && (
        <div className="form-group">
          <label>شمارهٔ موبایل مالک آژانس *</label>
          <input
            type="text"
            dir="ltr"
            placeholder="09xxxxxxxxx"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            required
          />
          <p className="field-hint">مالک باید از قبل در سایت ثبت‌نام کرده باشد.</p>
        </div>
      )}

      <div className="form-group">
        <label>نام آژانس *</label>
        <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
      </div>

      <div className="form-group">
        <label>توضیحات</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>تلفن ثابت</label>
          <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>موبایل</label>
          <input type="text" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>ایمیل</label>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>وبسایت</label>
          <input type="text" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
        </div>
      </div>

      <div className="form-group">
        <label>آدرس</label>
        <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </div>

      <div className="form-group">
        <label>موقعیت ملک</label>
        <select value={form.neighborhoodId} onChange={(e) => setForm((f) => ({ ...f, neighborhoodId: e.target.value }))}>
          <option value="">انتخاب کنید</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving || !cityId}>
          {saving ? "در حال ذخیره…" : isEdit ? "ذخیرهٔ تغییرات" : "ثبت آژانس"}
        </button>
      </div>
    </form>
  );
}

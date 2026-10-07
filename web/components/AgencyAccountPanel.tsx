"use client";

// پنل حساب آژانس (فاز ۶، بخش ۱۰) — اپلای/ویرایش/وضعیت تأیید/لوگو-کاور/مدیریت اعضا.

import { useEffect, useState } from "react";
import { VERIFICATION_STATUS_LABELS, MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS } from "@/lib/labels";

interface Agency {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  cover_image: string | null;
  address: string | null;
  city_id: number;
  neighborhood_id: number | null;
  verification_status: string;
  rejection_reason: string | null;
  suspension_reason: string | null;
}
interface SocialLink {
  provider: string | null;
  url: string;
}
interface SimpleLocation {
  id: number;
  name: string;
}
interface Member {
  id: number;
  user_id: number;
  membership_role: string;
  status: string;
  invited_by_user_id: number | null;
  user_name: string;
  user_phone: string;
  consultant_display_name: string | null;
}

export default function AgencyAccountPanel() {
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [cityId, setCityId] = useState<number | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<SimpleLocation[]>([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    mobile: "",
    email: "",
    website: "",
    address: "",
    neighborhoodId: "",
  });
  const [invitePhone, setInvitePhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    fetch("/api/account/agency")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.agency) {
          setAgency(d.agency);
          setLinks(d.socialLinks ?? []);
          setForm({
            name: d.agency.name,
            description: d.agency.description ?? "",
            phone: d.agency.phone ?? "",
            mobile: d.agency.mobile ?? "",
            email: d.agency.email ?? "",
            website: d.agency.website ?? "",
            address: d.agency.address ?? "",
            neighborhoodId: d.agency.neighborhood_id ? String(d.agency.neighborhood_id) : "",
          });
          fetch("/api/account/agency/members")
            .then((r) => (r.ok ? r.json() : null))
            .then((md) => md && setMembers(md.members))
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

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

  function buildPayload() {
    return {
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
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/account/agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت درخواست");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت درخواست");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const res = await fetch("/api/account/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), socialLinks: links }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیرهٔ تغییرات");
      setNotice("تغییرات ذخیره شد.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیرهٔ تغییرات");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(kind: "logo" | "cover", file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/account/agency/${kind}`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setAgency(data.agency);
    else setError(data.error || "خطا در بارگذاری تصویر");
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/account/agency/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: invitePhone.trim(), membershipRole: "consultant" }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "خطا در دعوت");
    setInvitePhone("");
    load();
  }

  async function manageMember(id: number, action: string) {
    const res = await fetch(`/api/account/agency/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) load();
  }

  if (loading) return <p>در حال بارگذاری…</p>;

  if (!agency) {
    return (
      <div className="form-section">
        <h2>ثبت درخواست آژانس املاک</h2>
        <form onSubmit={apply}>
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
              {saving ? "در حال ارسال…" : "ارسال درخواست"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="form-section">
        <h2>
          وضعیت آژانس{" "}
          <span className={`status-badge status-badge--${agency.verification_status}`}>
            {VERIFICATION_STATUS_LABELS[agency.verification_status]}
          </span>
        </h2>
        {agency.rejection_reason && <div className="error-box">دلیل رد: {agency.rejection_reason}</div>}
        {agency.suspension_reason && <div className="error-box">دلیل تعلیق: {agency.suspension_reason}</div>}

        {agency.cover_image && <div className="profile-cover"><img src={agency.cover_image} alt={agency.name} /></div>}
        <div className="form-grid">
          <div className="form-group">
            <label>لوگو</label>
            {agency.logo && <img src={agency.logo} alt={agency.name} className="profile-header__logo" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && uploadFile("logo", e.target.files[0])} />
          </div>
          <div className="form-group">
            <label>تصویر کاور</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && uploadFile("cover", e.target.files[0])} />
          </div>
        </div>

        <form onSubmit={saveEdit}>
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
            <label>شبکه‌های اجتماعی</label>
            {links.map((l, i) => (
              <div className="range-inputs" key={i}>
                <input
                  type="text"
                  placeholder="نام"
                  value={l.provider ?? ""}
                  onChange={(e) => setLinks((ls) => ls.map((x, j) => (j === i ? { ...x, provider: e.target.value } : x)))}
                />
                <input
                  type="text"
                  placeholder="آدرس (URL)"
                  value={l.url}
                  onChange={(e) => setLinks((ls) => ls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                />
                <button type="button" className="btn-secondary" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}>
                  حذف
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => setLinks((ls) => [...ls, { provider: "", url: "" }])}>
              افزودن لینک
            </button>
          </div>

          {error && <div className="error-box">{error}</div>}
          {notice && <div className="success-box">{notice}</div>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
            </button>
          </div>
        </form>
      </div>

      <div className="form-section">
        <h2>اعضای آژانس</h2>
        <form onSubmit={invite} className="range-inputs">
          <input type="text" placeholder="شمارهٔ موبایل مشاور برای دعوت" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} />
          <button type="submit" className="btn-primary">
            دعوت
          </button>
        </form>
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <span>
              {m.consultant_display_name ?? m.user_name} ({m.user_phone}) — {MEMBERSHIP_ROLE_LABELS[m.membership_role]} —{" "}
              <span className={`status-badge status-badge--${m.status}`}>{MEMBERSHIP_STATUS_LABELS[m.status]}</span>
            </span>
            <div className="member-row__actions">
              {m.status === "pending" && m.invited_by_user_id === null && (
                <>
                  <button type="button" className="btn-primary" onClick={() => manageMember(m.id, "accept")}>
                    پذیرفتن
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => manageMember(m.id, "reject")}>
                    رد کردن
                  </button>
                </>
              )}
              {m.status === "active" && (
                <button type="button" className="btn-danger" onClick={() => manageMember(m.id, "remove")}>
                  حذف عضو
                </button>
              )}
              {m.status === "suspended" && (
                <button type="button" className="btn-secondary" onClick={() => manageMember(m.id, "reactivate")}>
                  فعال‌سازی مجدد
                </button>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && <p className="search-empty">هنوز عضوی ثبت نشده است.</p>}
      </div>
    </>
  );
}

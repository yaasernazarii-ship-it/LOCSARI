"use client";

// پنل حساب مشاور (فاز ۶، بخش ۹) — اگر پروفایل مشاور وجود ندارد فرم اپلای، در غیر این صورت
// نمایش وضعیت تأیید + فرم ویرایش + بارگذاری آواتار + مدیریت دعوت‌های آژانس.

import { useEffect, useState } from "react";
import { VERIFICATION_STATUS_LABELS, MEMBERSHIP_ROLE_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { TASK_STATUSES } from "@/lib/validation";

interface Consultant {
  id: number;
  display_name: string;
  bio: string | null;
  phone: string | null;
  avatar: string | null;
  license_number: string | null;
  verification_status: string;
  rejection_reason: string | null;
  suspension_reason: string | null;
  is_active: boolean;
  agency_id: number | null;
}
interface SocialLink {
  provider: string | null;
  url: string;
}
interface AgencyOption {
  id: number;
  name: string;
}
interface Membership {
  id: number;
  agency_id: number;
  membership_role: string;
  status: string;
  invited_by_user_id: number | null;
  agency_name: string;
}
interface VipAssignment {
  id: number;
  status: string;
  result_note: string | null;
  assigned_at: string;
  advertisement_id: number;
  advertisement_title: string;
  advertisement_slug: string;
  vip_expires_at: string | null;
}

export default function ConsultantAccountPanel() {
  const [loading, setLoading] = useState(true);
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [vipAssignments, setVipAssignments] = useState<VipAssignment[]>([]);

  const [form, setForm] = useState({ displayName: "", bio: "", phone: "", licenseNumber: "", agencyId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    fetch("/api/account/consultant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.consultant) {
          setConsultant(d.consultant);
          setLinks(d.socialLinks ?? []);
          setForm({
            displayName: d.consultant.display_name,
            bio: d.consultant.bio ?? "",
            phone: d.consultant.phone ?? "",
            licenseNumber: d.consultant.license_number ?? "",
            agencyId: "",
          });
        }
      })
      .finally(() => setLoading(false));
    fetch("/api/agencies")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAgencies(d.agencies))
      .catch(() => {});
    fetch("/api/account/memberships")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMemberships(d.memberships))
      .catch(() => {});
    fetch("/api/account/consultant/vip-assignments")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.assignments && setVipAssignments(d.assignments))
      .catch(() => {});
  }

  useEffect(load, []);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/account/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          bio: form.bio.trim() || null,
          phone: form.phone.trim() || null,
          licenseNumber: form.licenseNumber.trim() || null,
          agencyId: form.agencyId ? Number(form.agencyId) : undefined,
        }),
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
      const res = await fetch("/api/account/consultant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          bio: form.bio.trim() || null,
          phone: form.phone.trim() || null,
          licenseNumber: form.licenseNumber.trim() || null,
          socialLinks: links,
        }),
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

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/account/consultant/avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setConsultant(data.consultant);
    else setError(data.error || "خطا در بارگذاری تصویر");
  }

  async function respondInvitation(id: number, action: "accept" | "reject") {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/account/memberships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "پاسخ به دعوت انجام نشد");
      setNotice(action === "accept" ? "دعوت آژانس پذیرفته شد." : "دعوت آژانس رد شد.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "پاسخ به دعوت انجام نشد");
    } finally {
      setSaving(false);
    }
  }

  async function updateVipAssignment(id: number, status: string, resultNote: string) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/account/consultant/vip-assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resultNote: resultNote.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ثبت وضعیت پیگیری انجام نشد");
      setNotice("وضعیت پیگیری آگهی ذخیره شد.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت وضعیت پیگیری انجام نشد");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>در حال بارگذاری…</p>;

  if (!consultant) {
    return (
      <div className="form-section">
        <h2>ثبت درخواست مشاور املاک</h2>
        <form onSubmit={apply}>
          <div className="form-group">
            <label>نام نمایشی *</label>
            <input type="text" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>توضیحات</label>
            <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>موبایل</label>
            <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>شمارهٔ پروانه (در صورت وجود)</label>
            <input type="text" value={form.licenseNumber} onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))} />
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
              {saving ? "در حال ارسال…" : "ارسال درخواست"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="success-box">{notice}</div>}
      <div className="form-section">
        <h2>
          وضعیت پروفایل مشاور{" "}
          <span className={`status-badge status-badge--${consultant.verification_status}`}>
            {VERIFICATION_STATUS_LABELS[consultant.verification_status]}
          </span>
        </h2>
        {consultant.rejection_reason && <div className="error-box">دلیل رد: {consultant.rejection_reason}</div>}
        {consultant.suspension_reason && <div className="error-box">دلیل تعلیق: {consultant.suspension_reason}</div>}

        {consultant.avatar && <img src={consultant.avatar} alt={consultant.display_name} className="profile-header__logo" />}
        <div className="form-group">
          <label>تصویر پروفایل</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
        </div>

        <form onSubmit={saveEdit}>
          <div className="form-group">
            <label>نام نمایشی *</label>
            <input type="text" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>توضیحات</label>
            <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>موبایل</label>
            <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>شمارهٔ پروانه</label>
            <input type="text" value={form.licenseNumber} onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))} />
          </div>

          <div className="form-group">
            <label>شبکه‌های اجتماعی</label>
            {links.map((l, i) => (
              <div className="range-inputs" key={i}>
                <input
                  type="text"
                  placeholder="نام (اینستاگرام، تلگرام...)"
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

      {memberships.filter((m) => m.invited_by_user_id !== null && m.status === "pending").length > 0 && (
        <div className="form-section">
          <h2>دعوت‌های آژانس</h2>
          {memberships
            .filter((m) => m.invited_by_user_id !== null && m.status === "pending")
            .map((m) => (
              <div key={m.id} className="member-row">
                <span>
                  {m.agency_name} — {MEMBERSHIP_ROLE_LABELS[m.membership_role]}
                </span>
                <div className="member-row__actions">
                  <button type="button" className="btn-primary" disabled={saving} onClick={() => respondInvitation(m.id, "accept")}>
                    پذیرفتن
                  </button>
                  <button type="button" className="btn-secondary" disabled={saving} onClick={() => respondInvitation(m.id, "reject")}>
                    رد کردن
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {memberships.filter((m) => m.status === "active").length > 0 && (
        <div className="form-section">
          <h2>عضویت‌های فعال</h2>
          {memberships
            .filter((m) => m.status === "active")
            .map((m) => (
              <div key={m.id} className="member-row">
                <span>
                  {m.agency_name} — {MEMBERSHIP_ROLE_LABELS[m.membership_role]}
                </span>
              </div>
            ))}
        </div>
      )}

      {vipAssignments.length > 0 && (
        <div className="form-section">
          <h2>آگهی‌های VIP در مسئولیت شما</h2>
          <p>وضعیت پیگیری و نتیجهٔ کار روی هر آگهی را اینجا ثبت کنید.</p>
          {vipAssignments.map((a) => (
            <VipAssignmentRow key={a.id} assignment={a} saving={saving} onSave={updateVipAssignment} />
          ))}
        </div>
      )}
    </>
  );
}

function VipAssignmentRow({
  assignment,
  saving,
  onSave,
}: {
  assignment: VipAssignment;
  saving: boolean;
  onSave: (id: number, status: string, resultNote: string) => void;
}) {
  const [status, setStatus] = useState(assignment.status);
  const [resultNote, setResultNote] = useState(assignment.result_note ?? "");

  return (
    <div className="member-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <span>
        <strong>{assignment.advertisement_title}</strong>{" "}
        <span className={`status-badge status-badge--${status}`}>{TASK_STATUS_LABELS[status] ?? status}</span>
      </span>
      <div className="range-inputs">
        <select value={status} disabled={saving} onChange={(e) => setStatus(e.target.value)}>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="نتیجهٔ پیگیری"
          value={resultNote}
          disabled={saving}
          onChange={(e) => setResultNote(e.target.value)}
        />
        <button type="button" className="btn-primary" disabled={saving} onClick={() => onSave(assignment.id, status, resultNote)}>
          ذخیره
        </button>
      </div>
    </div>
  );
}

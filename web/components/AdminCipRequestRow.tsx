"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "paid", label: "پرداخت‌شده" },
  { value: "contacted", label: "هماهنگی اولیه" },
  { value: "scheduled", label: "تصویربرداری زمان‌بندی شد" },
  { value: "filmed", label: "در حال تدوین" },
  { value: "published", label: "ویدیو آماده است" },
  { value: "cancelled", label: "لغوشده" },
];

export default function AdminCipRequestRow({
  requestId,
  status,
  adminNote,
  videoUrl,
  consultants,
  assignedConsultantId,
}: {
  requestId: number;
  status: string;
  adminNote: string | null;
  videoUrl: string | null;
  consultants: { id: number; display_name: string }[];
  assignedConsultantId: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState(status);
  const [note, setNote] = useState(adminNote ?? "");
  const [consultantId, setConsultantId] = useState(String(assignedConsultantId ?? ""));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aparatUrl, setAparatUrl] = useState(videoUrl ?? "");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cip-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(status === "awaiting_payment" ? {} : { status: nextStatus }), adminNote: note, consultantId: consultantId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      showToast("درخواست به‌روزرسانی شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  async function publishAparatVideo() {
    setPublishing(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cip-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: aparatUrl.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "خطا در انتشار ویدیو");
      showToast("ویدیوی آپارات ثبت و آگهی CIP منتشر شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در انتشار ویدیو");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary admin-header-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "بستن" : "مدیریت"}
      </button>
      {open && (
        <div className="admin-nested-panel fade-in" style={{ marginTop: 10, minWidth: 260 }}>
          {error && <p className="my-ad__error">{error}</p>}
          {status === "awaiting_payment" && <p className="form-hint">پرداخت این درخواست هنوز تکمیل نشده است؛ می‌توانید مشاور مسئول و یادداشت را ثبت کنید.</p>}
          {status !== "awaiting_payment" && (
            <div className="form-group">
              <label>وضعیت</label>
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>مشاور مسئول</label>
            <select value={consultantId} onChange={(e) => setConsultantId(e.target.value)}>
              <option value="">بدون مشاور مسئول</option>
              {consultants.map((consultant) => <option key={consultant.id} value={consultant.id}>{consultant.display_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>یادداشت برای کاربر</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="button" className="btn-primary admin-header-btn" disabled={saving} onClick={save}>
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>لینک ویدیوی آپارات برای انتشار</label>
            <input
              type="url"
              dir="ltr"
              placeholder="https://www.aparat.com/v/xxxxx"
              value={aparatUrl}
              disabled={status === "awaiting_payment"}
              onChange={(e) => setAparatUrl(e.target.value)}
            />
            <small>{status === "awaiting_payment" ? "ثبت و انتشار لینک ویدیو پس از تکمیل پرداخت فعال می‌شود." : "لینک معتبر آپارات را وارد کنید؛ با انتشار، آگهی در صفحهٔ عمومی CIP نمایش داده می‌شود."}</small>
          </div>
          <button type="button" className="btn-primary admin-header-btn" disabled={publishing || status === "awaiting_payment" || !aparatUrl.trim()} onClick={publishAparatVideo}>
            {publishing ? "در حال انتشار..." : "انتشار با لینک آپارات"}
          </button>
          {videoUrl && <p><a href={videoUrl} target="_blank">مشاهدهٔ ویدیوی فعلی</a></p>}
        </div>
      )}
    </>
  );
}

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
  const [uploading, setUploading] = useState(false);
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

  async function uploadVideo(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/cip-requests/${requestId}/video`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "خطا در بارگذاری ویدیو");
      showToast("ویدیو روی سرور بارگذاری و آگهی CIP منتشر شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری ویدیو");
    } finally {
      setUploading(false);
    }
  }

  async function archiveRequest() {
    if (!window.confirm("این آگهی از بخش CIP خارج و آرشیو می‌شود. ادامه می‌دهید؟")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cip-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "خطا در آرشیو آگهی CIP");
      showToast("آگهی از بخش CIP آرشیو شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در آرشیو آگهی CIP");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequest() {
    if (!window.confirm("درخواست CIP و ویدیوی آن حذف می‌شود. این عمل قابل بازگشت نیست. ادامه می‌دهید؟")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cip-requests/${requestId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "خطا در حذف درخواست CIP");
      showToast("درخواست CIP حذف شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف درخواست CIP");
    } finally {
      setSaving(false);
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
          <div className="admin-actions-bar" style={{ marginTop: 10 }}>
            <button type="button" className="btn-secondary admin-header-btn" disabled={saving} onClick={archiveRequest}>آرشیو از CIP</button>
            <button type="button" className="btn-danger admin-header-btn" disabled={saving} onClick={deleteRequest}>حذف از CIP</button>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>بارگذاری مستقیم ویدیوی عمودی</label>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              disabled={uploading || status === "awaiting_payment"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadVideo(file);
                e.currentTarget.value = "";
              }}
            />
            <small>{status === "awaiting_payment" ? "بارگذاری و انتشار ویدیو پس از تکمیل پرداخت فعال می‌شود." : "MP4، WebM یا MOV تا ۱۰۰ مگابایت. ویدیو به‌شکل عمودی پخش و تصویر اصلی آگهی به‌عنوان کاور افقی استفاده می‌شود."}</small>
          </div>
          {videoUrl && <p><a href={videoUrl} target="_blank" rel="noreferrer">مشاهدهٔ ویدیوی فعلی</a></p>}
        </div>
      )}
    </>
  );
}

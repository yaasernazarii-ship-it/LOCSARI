"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";

// ثبت آگهی CIP بدون پرداخت — فقط مدیر کل. درخواست مستقیماً با وضعیت «پرداخت‌شده» ثبت می‌شود.
export default function AdminCipFreePublishForm({
  plans,
  advertisements,
}: {
  plans: { id: number; title: string; price: number }[];
  advertisements: { id: number; title: string; user_name: string }[];
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState("");
  const [advertisementId, setAdvertisementId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cip-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, advertisementId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "خطا در ثبت درخواست CIP");
      if (!data?.request?.id || typeof data.request.id !== "number") throw new Error("ثبت درخواست CIP ناموفق بود");

      if (videoFile) {
        const formData = new FormData();
        formData.append("file", videoFile);
        const uploadRes = await fetch(`/api/admin/cip-requests/${data.request.id}/video`, { method: "POST", body: formData });
        const uploadData = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok) throw new Error(uploadData?.error || "خطا در بارگذاری ویدیو");
      }

      showToast(videoFile ? "ویدیو بارگذاری و آگهی CIP منتشر شد" : "درخواست CIP بدون پرداخت ثبت شد", "success");
      setPlanId("");
      setAdvertisementId("");
      setVideoFile(null);
      router.push("/admin/cip/requests");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت درخواست CIP");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = planId !== "" && advertisementId !== "";

  return (
    <form onSubmit={onSubmit} className="form-section fade-in">
      <h2>انتشار آگهی CIP بدون پرداخت (مدیر کل)</h2>
      <p className="form-hint">
        این بخش فقط برای مدیر کل است. آگهی انتخاب‌شده بدون طی کردن درگاه پرداخت، مستقیماً به‌عنوان
        «پرداخت‌شده» ثبت می‌شود. با انتخاب ویدیو، همان ویدیوی عمودی برای این آگهی بارگذاری و در صفحهٔ عمومی CIP منتشر می‌شود.
      </p>
      {error && <p className="my-ad__error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="form-group">
        <label>آگهی</label>
        <select value={advertisementId} onChange={(e) => setAdvertisementId(e.target.value)}>
          <option value="">انتخاب آگهی...</option>
          {advertisements.map((ad) => (
            <option key={ad.id} value={ad.id}>
              {ad.title} — {ad.user_name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>پلن CIP</label>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">انتخاب پلن...</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>ویدیوی آگهی (اختیاری)</label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          disabled={saving}
          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
        />
        <small>MP4، WebM یا MOV تا ۱۰۰ مگابایت. ابتدا فایل را انتخاب کنید، سپس دکمهٔ ثبت و انتشار را بزنید.</small>
      </div>
      {videoFile && <p className="form-hint">فایل انتخاب‌شده: {videoFile.name}</p>}

      <div className="admin-actions-bar">
        <button type="submit" className="btn-primary" disabled={saving || !canSubmit}>
          {saving ? "در حال ثبت و انتشار..." : videoFile ? "ثبت و انتشار آگهی" : "ثبت درخواست CIP"}
        </button>
      </div>
    </form>
  );
}

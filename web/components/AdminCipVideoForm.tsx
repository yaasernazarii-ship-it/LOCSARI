"use client";

// فرم مدیریت ویدیوی آپارات بخش CIP

import { useEffect, useState } from "react";
import { showToast } from "@/lib/adminToast";

export default function AdminCipVideoForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings/cip-video")
      .then((r) => r.json())
      .then((d) => setVideoUrl(d.videoUrl ?? ""))
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings/cip-video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.videoUrl) throw new Error(data?.error || "لینک ویدیو ذخیره نشد");
      setVideoUrl(data.videoUrl);
      showToast("ویدیوی CIP ذخیره شد", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="search-empty">در حال بارگذاری...</p>;

  return (
    <form onSubmit={onSubmit} className="form-section fade-in">
      <h2>ویدیوی CIP</h2>
      {error && <p className="my-ad__error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="form-group">
        <label>لینک ویدیوی آپارات (اختیاری)</label>
        <input
          type="text"
          dir="ltr"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.aparat.com/v/xxxxx"
        />
        <small>ویدیوی آپارات بخش CIP را وارد کنید.</small>
      </div>
      <div className="admin-actions-bar">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>
    </form>
  );
}

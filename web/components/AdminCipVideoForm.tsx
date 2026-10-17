"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/adminToast";

export default function AdminCipVideoForm() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/cip-video")
      .then((r) => r.json())
      .then((d) => setVideoUrl(d.videoUrl ?? null))
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  async function uploadVideo(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/settings/cip-video/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "خطا در بارگذاری ویدیو");
      setVideoUrl(data.videoUrl);
      showToast("ویدیوی معرفی CIP روی سرور بارگذاری شد", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری ویدیو");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="search-empty">در حال بارگذاری...</p>;

  return (
    <section className="form-section fade-in">
      <h2>ویدیوی معرفی CIP</h2>
      {error && <p className="my-ad__error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="form-group">
        <label>بارگذاری مستقیم ویدیو</label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadVideo(file);
            e.currentTarget.value = "";
          }}
        />
        <small>MP4، WebM یا MOV تا ۱۰۰ مگابایت. ویدیو روی سرور ذخیره و در صفحهٔ CIP نمایش داده می‌شود.</small>
      </div>
      {uploading && <p className="form-hint">در حال بارگذاری و انتشار ویدیو...</p>}
      {videoUrl && <p className="form-hint">ویدیوی معرفی فعلی ثبت شده است.</p>}
    </section>
  );
}

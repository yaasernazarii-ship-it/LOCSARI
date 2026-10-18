"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/adminToast";

export default function AdminCipVideoForm() {
  const [loading, setLoading] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/cip-video")
      .then((r) => r.json())
      .then((d) => setVideoUrl(d.videoUrl ?? null))
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  async function uploadVideo() {
    if (!videoFile) return;
    setUploading(true);
    setError("");
    try {
      const data = await new Promise<{ videoUrl: string }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/admin/settings/cip-video/upload");
        request.timeout = 10 * 60 * 1000;
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onload = () => {
          try {
            const response = JSON.parse(request.responseText || "null");
            if (request.status >= 200 && request.status < 300) resolve(response);
            else reject(new Error(response?.error || "خطا در بارگذاری ویدیو"));
          } catch {
            reject(new Error("پاسخ نامعتبر از سرور دریافت شد"));
          }
        };
        request.onerror = () => reject(new Error("ارتباط با سرور هنگام بارگذاری قطع شد"));
        request.ontimeout = () => reject(new Error("بارگذاری ویدیو بیش از حد طول کشید"));
        const formData = new FormData();
        formData.append("file", videoFile);
        request.send(formData);
      });
      setVideoUrl(data.videoUrl);
      setVideoFile(null);
      setInputKey((key) => key + 1);
      showToast("ویدیوی معرفی CIP روی سرور بارگذاری و منتشر شد", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری ویدیو");
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
          key={inputKey}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          disabled={uploading}
          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
        />
        <small>MP4، WebM یا MOV تا ۱۰۰ مگابایت. ابتدا فایل را انتخاب کنید، سپس دکمهٔ ثبت و انتشار را بزنید.</small>
      </div>
      <div className="admin-actions-bar">
        <button type="button" className="btn-primary" disabled={uploading || !videoFile} onClick={uploadVideo}>
          {uploading ? `در حال بارگذاری و انتشار${uploadProgress !== null ? ` (${uploadProgress}٪)` : ""}...` : "ثبت و انتشار ویدیوی معرفی"}
        </button>
      </div>
      {videoFile && <p className="form-hint">فایل انتخاب‌شده: {videoFile.name}</p>}
      {videoUrl && <p className="form-hint">ویدیوی معرفی فعلی ثبت و منتشر شده است.</p>}
    </section>
  );
}

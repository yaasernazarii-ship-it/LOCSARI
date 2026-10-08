"use client";

// فرم ایجاد/ویرایش صفحهٔ محتوای سایت (درباره ما، قوانین و مقررات، تماس با ما و ...)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";

type Props = { mode: "create" } | { mode: "edit"; pageId: number };

interface PageImage {
  id: number;
  url: string;
  altText: string | null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SitePageForm(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(false);

  const [images, setImages] = useState<PageImage[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (props.mode !== "edit") return;
    fetch(`/api/admin/content/pages/${props.pageId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.page) throw new Error(d.error || "صفحه یافت نشد");
        setTitle(d.page.title);
        setSlug(d.page.slug);
        setBody(d.page.body ?? "");
        setVideoUrl(d.page.video_url ?? "");
        setSeoTitle(d.page.seo_title ?? "");
        setSeoDescription(d.page.seo_description ?? "");
        setSortOrder(d.page.sort_order ?? 0);
        setIsPublished(d.page.is_published);
        setImages(
          (d.images ?? []).map((img: { id: number; url: string; alt_text: string | null }) => ({
            id: img.id,
            url: img.url,
            altText: img.alt_text,
          }))
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, [props]);

  function format(command: string, value?: string) {
    document.execCommand(command, false, value);
  }

  function insertImage() {
    const url = window.prompt("آدرس تصویر را وارد کنید");
    if (url?.trim()) format("insertImage", url.trim());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        body,
        videoUrl: videoUrl.trim() || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        sortOrder,
        isPublished,
      };
      const url = props.mode === "create" ? "/api/admin/content/pages" : `/api/admin/content/pages/${props.pageId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره‌سازی");
      showToast("صفحه ذخیره شد", "success");
      router.push("/admin/content");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage() {
    if (props.mode !== "edit" || !uploadFile) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if (uploadAlt.trim()) fd.append("altText", uploadAlt.trim());
      const res = await fetch(`/api/admin/content/pages/${props.pageId}/images`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در آپلود تصویر");
      setImages((imgs) => [...imgs, { id: data.image.id, url: data.image.url, altText: data.image.alt_text }]);
      setUploadFile(null);
      setUploadAlt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  }

  async function deleteImage(imageId: number) {
    if (props.mode !== "edit") return;
    const res = await fetch(`/api/admin/content/pages/${props.pageId}/images/${imageId}`, { method: "DELETE" });
    if (res.ok) setImages((imgs) => imgs.filter((x) => x.id !== imageId));
  }

  if (loading) return <p className="search-empty">در حال بارگذاری...</p>;

  return (
    <>
      <form onSubmit={onSubmit} className="form-section fade-in">
        {error && <p className="my-ad__error" style={{ marginBottom: 12 }}>{error}</p>}

        <div className="form-group">
          <label>عنوان صفحه *</label>
          <input
            type="text"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="مثلاً: درباره ما"
          />
        </div>

        <div className="form-group">
          <label>آدرس صفحه (Slug) *</label>
          <input
            type="text"
            value={slug}
            maxLength={150}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="about-us"
            dir="ltr"
          />
          <small>فقط حروف لاتین، عدد و خط تیره. آدرس نهایی: /p/{slug || "..."}</small>
        </div>

        <div className="form-group">
          <label>متن صفحه *</label>
          <div className="rich-editor" dir="rtl">
            <div className="rich-editor__toolbar" role="toolbar" aria-label="ابزارهای ویرایش متن">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "<h2>")}>تیتر</button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}>پررنگ</button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")}>فهرست</button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertOrderedList")}>فهرست شماره‌دار</button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={insertImage}>افزودن تصویر</button>
            </div>
            <div className="rich-editor__content" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: body }} onInput={(event) => setBody(event.currentTarget.innerHTML)} />
          </div>
          <small>می‌توانید تیتر، متن پررنگ، فهرست و تصویر به متن صفحه اضافه کنید.</small>
        </div>

        <div className="form-group">
          <label>لینک ویدیوی آپارات (اختیاری)</label>
          <input
            type="text"
            dir="ltr"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.aparat.com/v/xxxxx"
          />
          <small>در صورت وارد کردن، ویدیو بالای متن همین صفحه نمایش داده می‌شود.</small>
        </div>

        <div className="form-group">
          <label>ترتیب نمایش</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
          <small>عدد کمتر، جایگاه بالاتر در فهرست مدیریت دارد.</small>
        </div>

        <fieldset className="form-section" style={{ marginTop: 20 }}>
          <legend>تنظیمات سئو</legend>
          <div className="form-group">
            <label>عنوان سئو (اختیاری)</label>
            <input type="text" value={seoTitle} maxLength={200} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title || "عنوانی برای نتایج جستجو"} />
            <small>{seoTitle.length}/۲۰۰ — در صورت خالی‌بودن، عنوان صفحه استفاده می‌شود.</small>
          </div>
          <div className="form-group">
            <label>توضیحات سئو (اختیاری)</label>
            <textarea rows={3} value={seoDescription} maxLength={320} onChange={(e) => setSeoDescription(e.target.value)} placeholder="خلاصه‌ای کوتاه برای موتورهای جستجو" />
            <small>{seoDescription.length}/۳۲۰ — در صورت خالی‌بودن، متن صفحه استفاده می‌شود.</small>
          </div>
        </fieldset>

        <div className="form-group form-group--checkbox">
          <label>
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} /> منتشر شود (روی سایت نمایش داده شود)
          </label>
        </div>

        <div className="admin-actions-bar">
          <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !slug.trim()}>
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
          {props.mode === "edit" && slug && (
            <a className="btn-secondary" href={`/p/${slug}?preview=1`} target="_blank" rel="noreferrer">
              پیش‌نمایش صفحه
            </a>
          )}
        </div>
      </form>

      {props.mode === "edit" && (
        <div className="form-section fade-in">
          <h2>تصاویر صفحه (مثلاً اعتبارات و مجوزات)</h2>
          <p className="form-hint">
            تصاویری که اینجا اضافه می‌کنید در انتهای همین صفحه، زیر عنوان «اعتبارات و مجوزات» نمایش داده می‌شوند (تصویر: jpg، png، webp — حداکثر ۱۰ مگابایت).
          </p>

          {images.length > 0 && (
            <div className="media-grid">
              {images.map((img) => (
                <div key={img.id} className="media-item">
                  <img src={img.url} alt={img.altText ?? ""} />
                  <div className="media-item__actions">
                    <button type="button" className="media-item__delete" onClick={() => deleteImage(img.id)}>
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label>افزودن تصویر جدید</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="form-group">
            <label>توضیح تصویر (اختیاری)</label>
            <input type="text" value={uploadAlt} onChange={(e) => setUploadAlt(e.target.value)} placeholder="مثلاً: مجوز فعالیت از اتحادیه املاک" />
          </div>
          <div className="admin-actions-bar">
            <button type="button" className="btn-secondary" disabled={!uploadFile || uploading} onClick={uploadImage}>
              {uploading ? "در حال آپلود..." : "آپلود تصویر"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

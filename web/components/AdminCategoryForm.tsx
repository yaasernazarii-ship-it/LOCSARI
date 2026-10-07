"use client";

// فرم ایجاد/ویرایش دسته‌بندی — مشابه ساختار SitePageForm.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";
import ConfirmButton from "./ConfirmButton";

type CategoryRef = { id: number; name: string; parent_id: number | null };

type Props =
  | { mode: "create"; categories: CategoryRef[] }
  | { mode: "edit"; categoryId: number; categories: CategoryRef[]; canEdit: boolean; canDelete: boolean };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** فهرست دسته‌بندی‌های قابل‌انتخاب به‌عنوان والد، با تورفتگی — شامل خودِ دسته و زیرشاخه‌هایش نیست (برای جلوگیری از حلقه) */
function buildParentOptions(categories: CategoryRef[], excludeId?: number): { id: number; label: string }[] {
  const excluded = new Set<number>();
  if (excludeId !== undefined) {
    excluded.add(excludeId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of categories) {
        if (c.parent_id !== null && excluded.has(c.parent_id) && !excluded.has(c.id)) {
          excluded.add(c.id);
          changed = true;
        }
      }
    }
  }

  const byParent = new Map<number | null, CategoryRef[]>();
  for (const c of categories) {
    if (excluded.has(c.id)) continue;
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }

  const options: { id: number; label: string }[] = [];
  function walk(parentId: number | null, depth: number) {
    for (const c of byParent.get(parentId) ?? []) {
      options.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}` });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return options;
}

export default function AdminCategoryForm(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [image, setImage] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const readOnly = props.mode === "edit" && !props.canEdit;

  useEffect(() => {
    if (props.mode !== "edit") return;
    fetch(`/api/admin/categories/${props.categoryId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.category) throw new Error(d.error || "دسته‌بندی یافت نشد");
        setName(d.category.name);
        setSlug(d.category.slug);
        setParentId(d.category.parent_id != null ? String(d.category.parent_id) : "");
        setDescription(d.category.description ?? "");
        setIcon(d.category.icon ?? "");
        setImage(d.category.image ?? "");
        setSortOrder(d.category.sort_order ?? 0);
        setSeoTitle(d.category.seo_title ?? "");
        setSeoDescription(d.category.seo_description ?? "");
        setIsActive(d.category.is_active);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode]);

  const parentOptions = buildParentOptions(props.categories, props.mode === "edit" ? props.categoryId : undefined);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        parentId: parentId ? Number(parentId) : null,
        description: description.trim() || null,
        icon: icon.trim() || null,
        image: image.trim() || null,
        sortOrder,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        isActive,
      };
      const url = props.mode === "create" ? "/api/admin/categories" : `/api/admin/categories/${props.categoryId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره‌سازی");
      showToast("دسته‌بندی ذخیره شد", "success");
      if (props.mode === "create") {
        router.push(`/admin/categories/${data.category.id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (props.mode !== "edit") return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${props.categoryId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف");
      showToast("دسته‌بندی غیرفعال شد", "success");
      router.push("/admin/categories");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "خطا در حذف", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="search-empty">در حال بارگذاری...</p>;

  return (
    <form onSubmit={onSubmit} className="form-section fade-in">
      {error && <p className="my-ad__error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="form-grid">
        <div className="form-group">
          <label>نام دسته‌بندی *</label>
          <input
            type="text"
            value={name}
            maxLength={150}
            disabled={readOnly}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="مثلاً: آپارتمان"
          />
        </div>

        <div className="form-group">
          <label>Slug *</label>
          <input
            type="text"
            dir="ltr"
            value={slug}
            maxLength={150}
            disabled={readOnly}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="apartment"
          />
          <small>فقط حروف لاتین کوچک، عدد و خط تیره</small>
        </div>

        <div className="form-group">
          <label>دستهٔ والد</label>
          <select value={parentId} disabled={readOnly} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— بدون والد (دستهٔ اصلی) —</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>ترتیب نمایش</label>
          <input
            type="number"
            value={sortOrder}
            disabled={readOnly}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>توضیحات</label>
        <textarea rows={3} value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>آیکون (اختیاری)</label>
          <input type="text" dir="ltr" value={icon} disabled={readOnly} onChange={(e) => setIcon(e.target.value)} placeholder="نام آیکون یا اموجی" />
        </div>
        <div className="form-group">
          <label>تصویر (آدرس، اختیاری)</label>
          <input type="text" dir="ltr" value={image} disabled={readOnly} onChange={(e) => setImage(e.target.value)} />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>عنوان سئو (اختیاری)</label>
          <input type="text" value={seoTitle} disabled={readOnly} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} />
        </div>
        <div className="form-group">
          <label>توضیحات سئو (اختیاری)</label>
          <input type="text" value={seoDescription} disabled={readOnly} onChange={(e) => setSeoDescription(e.target.value)} maxLength={300} />
        </div>
      </div>

      <div className="form-group form-group--checkbox">
        <label>
          <input type="checkbox" checked={isActive} disabled={readOnly} onChange={(e) => setIsActive(e.target.checked)} /> فعال باشد
        </label>
      </div>

      {!readOnly && (
        <div className="admin-actions-bar" style={{ justifyContent: "space-between" }}>
          <button type="submit" className="btn-primary" disabled={saving || !name.trim() || !slug.trim()}>
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
          {props.mode === "edit" && props.canDelete && (
            <ConfirmButton
              label="حذف دسته‌بندی"
              confirmText="این دسته‌بندی غیرفعال می‌شود. مطمئن هستید؟"
              className="btn-danger admin-header-btn"
              disabled={deleting}
              onConfirm={onDelete}
            />
          )}
        </div>
      )}
    </form>
  );
}

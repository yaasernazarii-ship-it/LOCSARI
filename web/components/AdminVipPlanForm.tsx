"use client";

// فرم ایجاد/ویرایش پلن اشتراک VIP — مشابه ساختار AdminCategoryForm.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";
import ConfirmButton from "./ConfirmButton";

type Props = { mode: "create" } | { mode: "edit"; planId: number };

export default function AdminVipPlanForm(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [adLimit, setAdLimit] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (props.mode !== "edit") return;
    fetch(`/api/admin/vip-plans/${props.planId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.plan) throw new Error(d.error || "پلن یافت نشد");
        setTitle(d.plan.title);
        setDescription(d.plan.description ?? "");
        setPrice(d.plan.price);
        setAdLimit(d.plan.ad_limit);
        setDiscountPercent(Number(d.plan.discount_percent));
        setSortOrder(d.plan.sort_order ?? 0);
        setIsActive(d.plan.is_active);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        price,
        adLimit,
        discountPercent,
        sortOrder,
        isActive,
      };
      const url = props.mode === "create" ? "/api/admin/vip-plans" : `/api/admin/vip-plans/${props.planId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره‌سازی");
      showToast("پلن ذخیره شد", "success");
      if (props.mode === "create") {
        router.push(`/admin/vip-plans/${data.plan.id}`);
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
      const res = await fetch(`/api/admin/vip-plans/${props.planId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف");
      showToast("پلن حذف شد", "success");
      router.push("/admin/vip-plans");
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
          <label>عنوان پلن *</label>
          <input type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: یک ماه" />
        </div>
        <div className="form-group">
          <label>قیمت (تومان) *</label>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label>سقف آگهی VIP *</label>
          <input type="number" min={1} value={adLimit} onChange={(e) => setAdLimit(Number(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label>تخفیف (درصد)</label>
          <input type="number" min={0} max={100} step="0.01" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label>ترتیب نمایش</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="form-group">
        <label>توضیحات</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="form-group form-group--checkbox">
        <label>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> فعال باشد
        </label>
      </div>

      <div className="admin-actions-bar" style={{ justifyContent: "space-between" }}>
        <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </button>
        {props.mode === "edit" && (
          <ConfirmButton
            label="حذف پلن"
            confirmText="این پلن حذف می‌شود. مطمئن هستید؟"
            className="btn-danger admin-header-btn"
            disabled={deleting}
            onConfirm={onDelete}
          />
        )}
      </div>
    </form>
  );
}

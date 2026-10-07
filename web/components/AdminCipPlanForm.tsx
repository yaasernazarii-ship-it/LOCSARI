"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";
import ConfirmButton from "./ConfirmButton";

type Props = { mode: "create" } | { mode: "edit"; planId: number };

export default function AdminCipPlanForm(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [price, setPrice] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (props.mode !== "edit") return;
    fetch(`/api/admin/cip-plans/${props.planId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.plan) throw new Error(d.error || "پلن یافت نشد");
        setTitle(d.plan.title);
        setDescription(d.plan.description ?? "");
        setFeatures(d.plan.features ?? "");
        setPrice(d.plan.price);
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
      const url = props.mode === "create" ? "/api/admin/cip-plans" : `/api/admin/cip-plans/${props.planId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description, features, price, sortOrder, isActive }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره‌سازی");
      showToast("پلن ذخیره شد", "success");
      if (props.mode === "create") router.push(`/admin/cip/plans/${data.plan.id}`);
      else router.refresh();
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
      const res = await fetch(`/api/admin/cip-plans/${props.planId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف");
      showToast("پلن حذف شد", "success");
      router.push("/admin/cip/plans");
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
          <input type="text" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: ویدیوی ویژه" />
        </div>
        <div className="form-group">
          <label>قیمت (تومان) *</label>
          <input type="number" min={1} value={price || ""} onChange={(e) => setPrice(Number(e.target.value) || 0)} placeholder="مثلاً: 2500000" />
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
      <div className="form-group">
        <label>امکانات (هر مورد در یک خط)</label>
        <textarea rows={5} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={"ضبط در محل\nتدوین حرفه‌ای"} />
      </div>
      <div className="form-group form-group--checkbox">
        <label>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> فعال باشد
        </label>
      </div>
      <div className="admin-actions-bar" style={{ justifyContent: "space-between" }}>
        <button type="submit" className="btn-primary" disabled={saving || !title.trim() || price <= 0}>{saving ? "در حال ذخیره..." : "ذخیره"}</button>
        {props.mode === "edit" && (
          <ConfirmButton label="حذف پلن" confirmText="این پلن حذف می‌شود. مطمئن هستید؟" className="btn-danger admin-header-btn" disabled={deleting} onConfirm={onDelete} />
        )}
      </div>
    </form>
  );
}

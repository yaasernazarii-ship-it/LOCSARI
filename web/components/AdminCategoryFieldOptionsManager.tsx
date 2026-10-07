"use client";

// مدیریت گزینه‌های یک فیلد انتخابی (select/multi_select) دسته‌بندی — از API موجود استفاده می‌کند.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";
import ConfirmButton from "./ConfirmButton";

interface OptionItem {
  id: number;
  value: string;
  label_fa: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminCategoryFieldOptionsManager({
  categoryId,
  fieldId,
  options,
  canCreate,
  canEdit,
  canDelete,
}: {
  categoryId: number;
  fieldId: number;
  options: OptionItem[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const apiPath = `/api/admin/categories/${categoryId}/fields/${fieldId}/options`;

  const [rows, setRows] = useState<OptionItem[]>(options);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [newValue, setNewValue] = useState("");
  const [newLabelFa, setNewLabelFa] = useState("");
  const [creating, setCreating] = useState(false);

  function updateRow(id: number, patch: Partial<OptionItem>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function saveRow(item: OptionItem) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`${apiPath}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelFa: item.label_fa.trim(), sortOrder: item.sort_order }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      showToast("گزینه ذخیره شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item: OptionItem) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`${apiPath}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در تغییر وضعیت");
      updateRow(item.id, { is_active: !item.is_active });
      showToast(item.is_active ? "غیرفعال شد" : "فعال شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در تغییر وضعیت");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(item: OptionItem) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`${apiPath}/${item.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف");
      setRows((rs) => rs.filter((r) => r.id !== item.id));
      showToast("گزینه حذف شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف");
    } finally {
      setBusyId(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue.trim(), labelFa: newLabelFa.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ثبت");
      setRows((rs) => [...rs, data.option]);
      setNewValue("");
      setNewLabelFa("");
      showToast("گزینه افزوده شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-nested-panel fade-in">
      {error && <div className="error-box">{error}</div>}

      <div className="admin-table-wrap" style={{ marginBottom: 12 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>مقدار (value)</th>
              <th>برچسب فارسی</th>
              <th>ترتیب</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td dir="ltr" style={{ textAlign: "left" }}>{item.value}</td>
                <td>
                  <input
                    type="text"
                    value={item.label_fa}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(item.id, { label_fa: e.target.value })}
                    style={{ minWidth: 120 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.sort_order}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(item.id, { sort_order: Number(e.target.value) || 0 })}
                    style={{ width: 70 }}
                  />
                </td>
                <td>
                  <span className={`status-badge status-badge--${item.is_active ? "approved" : "suspended"}`}>
                    {item.is_active ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {canEdit && (
                    <>
                      <button type="button" className="btn-secondary admin-header-btn" disabled={busyId === item.id} onClick={() => saveRow(item)}>
                        ذخیره
                      </button>
                      <button
                        type="button"
                        className={item.is_active ? "btn-danger admin-header-btn" : "btn-primary admin-header-btn"}
                        disabled={busyId === item.id}
                        onClick={() => toggleActive(item)}
                      >
                        {item.is_active ? "غیرفعال کردن" : "فعال کردن"}
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <ConfirmButton
                      label="حذف"
                      className="btn-danger admin-header-btn"
                      disabled={busyId === item.id}
                      onConfirm={() => onDelete(item)}
                    />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="search-empty">
                  گزینه‌ای ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <form onSubmit={onCreate} className="admin-inline-form" style={{ flexWrap: "wrap" }}>
          <input type="text" dir="ltr" placeholder="value" value={newValue} onChange={(e) => setNewValue(e.target.value)} required />
          <input type="text" placeholder="برچسب فارسی" value={newLabelFa} onChange={(e) => setNewLabelFa(e.target.value)} required />
          <button type="submit" className="btn-primary admin-header-btn" disabled={creating}>
            {creating ? "در حال ثبت…" : "+ افزودن گزینه"}
          </button>
        </form>
      )}
    </div>
  );
}

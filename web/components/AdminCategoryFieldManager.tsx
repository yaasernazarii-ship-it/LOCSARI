"use client";

// مدیریت فیلدهای اختصاصی یک دسته‌بندی (category_fields) — از API موجود استفاده می‌کند.
// برای فیلدهای انتخابی (select/multi_select) امکان مدیریت گزینه‌ها هم فراهم است.

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";
import ConfirmButton from "./ConfirmButton";
import AdminCategoryFieldOptionsManager from "./AdminCategoryFieldOptionsManager";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "متن",
  number: "عدد",
  boolean: "بله/خیر",
  select: "انتخابی (تک‌گزینه‌ای)",
  multi_select: "انتخابی (چندگزینه‌ای)",
  date: "تاریخ",
};

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS);
const OPTION_BASED_TYPES = new Set(["select", "multi_select"]);

interface OptionItem {
  id: number;
  value: string;
  label_fa: string;
  sort_order: number;
  is_active: boolean;
}

interface FieldItem {
  id: number;
  key: string;
  label_fa: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  options: OptionItem[];
}

export default function AdminCategoryFieldManager({
  categoryId,
  fields,
  canCreate,
  canEdit,
  canDelete,
}: {
  categoryId: number;
  fields: FieldItem[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const apiPath = `/api/admin/categories/${categoryId}/fields`;

  const [rows, setRows] = useState<FieldItem[]>(fields);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const [newKey, setNewKey] = useState("");
  const [newLabelFa, setNewLabelFa] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [creating, setCreating] = useState(false);

  function updateRow(id: number, patch: Partial<FieldItem>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggleExpanded(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveRow(item: FieldItem) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`${apiPath}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelFa: item.label_fa.trim(),
          fieldType: item.field_type,
          isRequired: item.is_required,
          sortOrder: item.sort_order,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      showToast("فیلد ذخیره شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item: FieldItem) {
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

  async function onDelete(item: FieldItem) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`${apiPath}/${item.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف");
      setRows((rs) => rs.filter((r) => r.id !== item.id));
      showToast("فیلد حذف شد", "success");
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
        body: JSON.stringify({
          key: newKey.trim(),
          labelFa: newLabelFa.trim(),
          fieldType: newFieldType,
          isRequired: newIsRequired,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ثبت");
      setRows((rs) => [...rs, { ...data.field, options: [] }]);
      setNewKey("");
      setNewLabelFa("");
      setNewFieldType("text");
      setNewIsRequired(false);
      showToast("فیلد افزوده شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="form-section fade-in">
      <h2>فیلدهای اختصاصی</h2>
      {error && <div className="error-box">{error}</div>}

      <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>کلید (key)</th>
              <th>برچسب فارسی</th>
              <th>نوع فیلد</th>
              <th>اجباری</th>
              <th>ترتیب</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <Fragment key={item.id}>
                <tr>
                  <td dir="ltr" style={{ textAlign: "left" }}>{item.key}</td>
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
                    <select
                      value={item.field_type}
                      disabled={!canEdit}
                      onChange={(e) => updateRow(item.id, { field_type: e.target.value })}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={item.is_required}
                      disabled={!canEdit}
                      onChange={(e) => updateRow(item.id, { is_required: e.target.checked })}
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
                    {OPTION_BASED_TYPES.has(item.field_type) && (
                      <button type="button" className="btn-secondary admin-header-btn" onClick={() => toggleExpanded(item.id)}>
                        {expanded.has(item.id) ? "بستن گزینه‌ها" : `گزینه‌ها (${item.options.length.toLocaleString("fa-IR")})`}
                      </button>
                    )}
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
                        confirmText="این فیلد و مقادیرش برای همیشه حذف می‌شود. مطمئن هستید؟"
                        className="btn-danger admin-header-btn"
                        disabled={busyId === item.id}
                        onConfirm={() => onDelete(item)}
                      />
                    )}
                  </td>
                </tr>
                {expanded.has(item.id) && OPTION_BASED_TYPES.has(item.field_type) && (
                  <tr>
                    <td colSpan={7}>
                      <AdminCategoryFieldOptionsManager
                        categoryId={categoryId}
                        fieldId={item.id}
                        options={item.options}
                        canCreate={canCreate}
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="search-empty">
                  فیلدی برای این دسته‌بندی ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <form onSubmit={onCreate} className="admin-inline-form" style={{ flexWrap: "wrap" }}>
          <input
            type="text"
            dir="ltr"
            placeholder="key (مثلاً area_size)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            required
          />
          <input type="text" placeholder="برچسب فارسی" value={newLabelFa} onChange={(e) => setNewLabelFa(e.target.value)} required />
          <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={newIsRequired} onChange={(e) => setNewIsRequired(e.target.checked)} /> اجباری
          </label>
          <button type="submit" className="btn-primary admin-header-btn" disabled={creating}>
            {creating ? "در حال ثبت…" : "+ افزودن فیلد"}
          </button>
        </form>
      )}
    </div>
  );
}

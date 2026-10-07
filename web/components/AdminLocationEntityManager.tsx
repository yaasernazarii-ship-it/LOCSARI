"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/adminToast";

interface Item {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminLocationEntityManager({ cityId, items }: { cityId: number; items: Item[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Item[]>(items);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  function updateRowField(id: number, field: "name" | "slug", value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function saveRow(item: Item) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/locations/neighborhoods/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name.trim(), slug: item.slug.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      showToast("ذخیره شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item: Item) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/locations/neighborhoods/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در تغییر وضعیت");
      showToast(item.is_active ? "غیرفعال شد" : "فعال شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در تغییر وضعیت");
    } finally {
      setBusyId(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/locations/neighborhoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim(), cityId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ثبت");
      setNewName("");
      setNewSlug("");
      setNewSlugTouched(false);
      showToast("افزوده شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="form-section fade-in">
      <h2>موقعیت‌های ملک</h2>
      {error && <div className="error-box">{error}</div>}

      <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>Slug</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  <input type="text" value={item.name} onChange={(e) => updateRowField(item.id, "name", e.target.value)} style={{ minWidth: 140 }} />
                </td>
                <td>
                  <input type="text" dir="ltr" value={item.slug} onChange={(e) => updateRowField(item.id, "slug", e.target.value)} style={{ minWidth: 120 }} />
                </td>
                <td>
                  <span className={`status-badge status-badge--${item.is_active ? "approved" : "suspended"}`}>
                    {item.is_active ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 8 }}>
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
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="search-empty">
                  هنوز موقعیت ملکی ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onCreate} className="admin-inline-form" style={{ flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="نام موقعیت ملک"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            if (!newSlugTouched) setNewSlug(slugify(e.target.value));
          }}
          required
        />
        <input
          type="text"
          dir="ltr"
          placeholder="slug"
          value={newSlug}
          onChange={(e) => {
            setNewSlugTouched(true);
            setNewSlug(e.target.value);
          }}
          required
        />
        <button type="submit" className="btn-primary admin-header-btn" disabled={creating}>
          {creating ? "در حال ثبت…" : "+ افزودن موقعیت"}
        </button>
      </form>
    </div>
  );
}

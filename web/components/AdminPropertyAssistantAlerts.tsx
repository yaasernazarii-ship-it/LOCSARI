"use client";

import { useMemo, useState } from "react";

type Alert = {
  id: number;
  recipient_name: string | null;
  phone: string;
  query_text: string;
  deal_type: string | null;
  property_type: string | null;
  neighborhood_name: string | null;
  is_active: boolean;
  created_at: Date;
};

function label(value: string | null, values: Record<string, string>) {
  return value ? values[value] ?? value : "تعیین نشده";
}

export default function AdminPropertyAssistantAlerts({ initialAlerts, canEdit }: { initialAlerts: Alert[]; canEdit: boolean }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const filtered = useMemo(() => alerts.filter((alert) => {
    const matchesText = `${alert.recipient_name ?? ""} ${alert.phone} ${alert.query_text} ${alert.neighborhood_name ?? ""}`.includes(search.trim());
    const matchesStatus = status === "all" || (status === "active" ? alert.is_active : !alert.is_active);
    return matchesText && matchesStatus;
  }), [alerts, search, status]);

  async function toggle(alert: Alert) {
    setUpdatingId(alert.id);
    try {
      const response = await fetch("/api/admin/property-assistant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertId: alert.id, isActive: !alert.is_active }) });
      if (!response.ok) throw new Error();
      setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, is_active: !item.is_active } : item));
    } finally {
      setUpdatingId(null);
    }
  }

  return <section className="form-section">
    <h2>درخواست‌های ثبت‌شده</h2>
    <div className="property-assistant__form" style={{ marginBottom: 16 }}>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در نام، شماره، محله یا متن نیاز" />
      <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">همه</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select>
    </div>
    {filtered.length === 0 ? <p className="search-empty">درخواستی مطابق فیلتر پیدا نشد.</p> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>متقاضی</th><th>شماره تماس</th><th>نیاز ثبت‌شده</th><th>جزئیات</th><th>وضعیت</th><th>تاریخ ثبت</th><th>عملیات</th></tr></thead><tbody>{filtered.map((alert) => <tr key={alert.id}><td>{alert.recipient_name ?? "—"}</td><td dir="ltr">{alert.phone}</td><td>{alert.query_text}</td><td>{[label(alert.deal_type, { sale: "خرید", mortgage_rent: "رهن و اجاره" }), label(alert.property_type, { apartment: "آپارتمان", villa: "ویلا", land: "زمین" }), alert.neighborhood_name].filter(Boolean).join(" · ")}</td><td><span className={`status-badge status-badge--${alert.is_active ? "approved" : "rejected"}`}>{alert.is_active ? "فعال" : "غیرفعال"}</span></td><td>{new Date(alert.created_at).toLocaleString("fa-IR")}</td><td>{canEdit && <button type="button" className="btn-secondary" disabled={updatingId === alert.id} onClick={() => toggle(alert)}>{alert.is_active ? "توقف اطلاع‌رسانی" : "فعال‌سازی"}</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}

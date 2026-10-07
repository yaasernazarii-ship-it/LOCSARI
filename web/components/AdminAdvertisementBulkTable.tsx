"use client";

// جدول آگهی‌ها با پشتیبانی از عملیات دسته‌ای (انتخاب چندتایی + تأیید/رد/آرشیو/حذف گروهی).
// از همان Endpointهای تکی موجود (publish/reject/archive/DELETE) به‌صورت موازی برای هر شناسه استفاده می‌کند؛
// هیچ منطق تصمیم‌گیری یا Endpoint جدیدی در سرور اضافه نشده است.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmButton from "./ConfirmButton";
import AdminAdvertisementRowActions from "./AdminAdvertisementRowActions";
import { showToast } from "@/lib/adminToast";

export interface BulkAdRow {
  id: number;
  publicCode: string;
  advertisementType: "free" | "vip" | "cip";
  title: string;
  categoryName: string;
  cityName: string;
  transactionTypeLabel: string;
  priceLine: string;
  status: string;
  statusLabel: string;
  ownerName: string;
  ownerAccountType: "user" | "consultant" | "agency";
  ownerPhone: string;
  consultantOrAgency: string;
  createdAtLabel: string;
  publishedAtLabel: string;
}

export default function AdminAdvertisementBulkTable({
  rows,
  canPublish,
  canReject,
  canArchive,
  canEdit,
  canDelete,
}: {
  rows: BulkAdRow[];
  canPublish: boolean;
  canReject: boolean;
  canArchive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const showBulkBar = canPublish || canReject || canArchive || canDelete;

  function toggleOne(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function runBulk(action: "publish" | "reject" | "archive", body?: Record<string, unknown>) {
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/advertisements/${id}/${action}`, {
            method: "POST",
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          }).then((r) => r.ok)
        )
      );
      const failCount = results.filter((ok) => !ok).length;
      if (failCount > 0) showToast(`${failCount} مورد با خطا مواجه شد`, "error");
      else showToast("عملیات روی همهٔ موارد انتخاب‌شده انجام شد", "success");
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onBulkDelete() {
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(ids.map((id) => fetch(`/api/advertisements/${id}`, { method: "DELETE" }).then((r) => r.ok)));
      const failCount = results.filter((ok) => !ok).length;
      if (failCount > 0) showToast(`${failCount} مورد حذف نشد`, "error");
      else showToast("موارد انتخاب‌شده حذف شدند", "success");
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onBulkReject() {
    const reason = window.prompt("دلیل رد (برای همهٔ موارد انتخاب‌شده اعمال می‌شود):");
    if (!reason || !reason.trim()) return;
    runBulk("reject", { reason: reason.trim() });
  }

  return (
    <>
      {showBulkBar && selected.size > 0 && (
        <div className="admin-bulk-bar">
          <span className="admin-bulk-bar__count">{selected.size.toLocaleString("fa-IR")} مورد انتخاب شده</span>
          {canPublish && (
            <button type="button" className="btn-primary admin-header-btn" disabled={busy} onClick={() => runBulk("publish")}>
              تأیید و انتشار گروهی
            </button>
          )}
          {canReject && (
            <button type="button" className="btn-danger admin-header-btn" disabled={busy} onClick={onBulkReject}>
              رد گروهی
            </button>
          )}
          {canArchive && (
            <button type="button" className="btn-secondary admin-header-btn" disabled={busy} onClick={() => runBulk("archive")}>
              آرشیو گروهی
            </button>
          )}
          {canDelete && (
            <ConfirmButton
              label="حذف گروهی"
              confirmText="همهٔ موارد انتخاب‌شده برای همیشه حذف می‌شوند."
              className="btn-danger admin-header-btn"
              disabled={busy}
              onConfirm={onBulkDelete}
            />
          )}
          <button type="button" className="btn-secondary admin-header-btn" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </div>
      )}

      <div className="admin-table-wrap">
        {rows.length === 0 ? (
          <p className="admin-table-empty">هیچ آگهی‌ای مطابق فیلترها یافت نشد.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {showBulkBar && (
                  <th>
                    <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
                  </th>
                )}
                <th>شناسه</th>
                <th>نوع آگهی</th>
                <th>عنوان</th>
                <th>دسته‌بندی</th>
                <th>شهر</th>
                <th>نوع معامله</th>
                <th>قیمت</th>
                <th>وضعیت</th>
                <th>مالک</th>
                <th>مشاور/آژانس</th>
                <th>تاریخ ثبت</th>
                <th>تاریخ انتشار</th>
                {(canEdit || canDelete) && <th>عملیات</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((ad) => (
                <tr key={ad.id}>
                  {showBulkBar && (
                    <td>
                      <input type="checkbox" checked={selected.has(ad.id)} onChange={() => toggleOne(ad.id)} />
                    </td>
                  )}
                  <td dir="ltr">{ad.publicCode}</td>
                  <td><span className={`status-badge status-badge--${ad.advertisementType}`}>{ad.advertisementType === "cip" ? "CIP" : ad.advertisementType === "vip" ? "VIP" : "رایگان"}</span></td>
                  <td>
                    <Link href={`/admin/advertisements/${ad.id}`}>{ad.title}</Link>
                  </td>
                  <td>{ad.categoryName}</td>
                  <td>{ad.cityName}</td>
                  <td>{ad.transactionTypeLabel}</td>
                  <td>{ad.priceLine}</td>
                  <td>
                    <span className={`status-badge status-badge--${ad.status}`}>{ad.statusLabel}</span>
                  </td>
                  <td>
                    {ad.ownerName}
                    <br />
                    <span style={{ color: "#999" }}>{ad.ownerPhone}</span>
                    <br />
                    <small>{ad.ownerAccountType === "agency" ? "حساب آژانس" : ad.ownerAccountType === "consultant" ? "حساب مشاور" : "حساب کاربر عادی"}</small>
                  </td>
                  <td>{ad.consultantOrAgency}</td>
                  <td>{ad.createdAtLabel}</td>
                  <td>{ad.publishedAtLabel}</td>
                  {(canEdit || canDelete) && (
                    <td>
                      <AdminAdvertisementRowActions advertisementId={ad.id} canEdit={canEdit} canDelete={canDelete} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

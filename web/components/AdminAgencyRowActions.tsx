"use client";

// عملیات سطری در جدول لیست آژانس‌های پنل مدیریت — ویرایش (لینک) و حذف کامل.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmButton from "./ConfirmButton";
import { showToast } from "@/lib/adminToast";

export default function AdminAgencyRowActions({
  agencyId,
  canEdit,
  canDelete,
}: {
  agencyId: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف آژانس");
      showToast("آژانس حذف شد", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "خطا در حذف آژانس", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {canEdit && <Link href={`/admin/agencies/${agencyId}/edit`}>ویرایش</Link>}
      {canDelete && <ConfirmButton label="حذف" className="btn-danger admin-header-btn" disabled={loading} onConfirm={onDelete} />}
    </div>
  );
}

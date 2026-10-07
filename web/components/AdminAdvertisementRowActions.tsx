"use client";

// عملیات سطری در جدول لیست آگهی‌های پنل مدیریت — ویرایش (لینک) و حذف کامل (فراخوانی همان
// Endpoint موجود DELETE /api/advertisements/:id که برای بازبین مرکزی در هر وضعیتی مجاز است).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmButton from "./ConfirmButton";
import { showToast } from "@/lib/adminToast";

export default function AdminAdvertisementRowActions({
  advertisementId,
  canEdit,
  canDelete,
}: {
  advertisementId: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/advertisements/${advertisementId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف آگهی");
      showToast("آگهی حذف شد", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "خطا در حذف آگهی", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {canEdit && <Link href={`/admin/advertisements/${advertisementId}/edit`}>ویرایش</Link>}
      {canDelete && <ConfirmButton label="حذف" className="btn-danger admin-header-btn" disabled={loading} onConfirm={onDelete} />}
    </div>
  );
}

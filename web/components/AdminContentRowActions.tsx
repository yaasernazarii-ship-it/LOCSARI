"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmButton from "./ConfirmButton";
import { showToast } from "@/lib/adminToast";

export default function AdminContentRowActions({ pageId, canEdit, canDelete }: { pageId: number; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content/pages/${pageId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف");
      showToast("صفحه حذف شد", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "خطا در حذف", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {canEdit && <Link href={`/admin/content/${pageId}/edit`}>ویرایش</Link>}
      {canDelete && <ConfirmButton label="حذف" confirmText="آیا از حذف این صفحه مطمئن هستید؟" className="btn-danger admin-header-btn" disabled={loading} onConfirm={onDelete} />}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmButton from "./ConfirmButton";
import { showToast } from "@/lib/adminToast";

export default function AdminAgencyActions({
  agencyId,
  status,
  canApprove,
  canEdit,
  canDelete,
}: {
  agencyId: number;
  status: string;
  canApprove: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject" | "suspend", reason?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در انجام عملیات");
        return;
      }
      showToast("عملیات با موفقیت انجام شد", "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onReject() {
    const reason = window.prompt("دلیل رد آژانس را وارد کنید:");
    if (!reason?.trim()) return;
    run("reject", reason.trim());
  }

  function onSuspend() {
    const reason = window.prompt("دلیل تعلیق آژانس را وارد کنید:");
    if (!reason?.trim()) return;
    run("suspend", reason.trim());
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف آژانس");
      showToast("آژانس حذف شد", "success");
      router.push("/admin/agencies");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف آژانس");
    } finally {
      setBusy(false);
    }
  }

  if (!canApprove && !canEdit && !canDelete) return null;

  return (
    <div className="admin-inline-form">
      {error && <p style={{ color: "#991b1b" }}>{error}</p>}
      {canApprove && (status === "pending" || status === "rejected" || status === "suspended") && (
        <button className="btn-primary" disabled={busy} onClick={() => run("approve")}>
          تأیید
        </button>
      )}
      {canApprove && status === "pending" && (
        <button className="btn-danger" disabled={busy} onClick={onReject}>
          رد
        </button>
      )}
      {canApprove && status === "approved" && (
        <button className="btn-danger" disabled={busy} onClick={onSuspend}>
          تعلیق
        </button>
      )}
      {canEdit && (
        <Link href={`/admin/agencies/${agencyId}/edit`} className="btn-secondary">
          ویرایش
        </Link>
      )}
      {canDelete && (
        <ConfirmButton label="حذف کامل" confirmText="این آژانس برای همیشه حذف می‌شود." disabled={busy} onConfirm={onDelete} />
      )}
    </div>
  );
}

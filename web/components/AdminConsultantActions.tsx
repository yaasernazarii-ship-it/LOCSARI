"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminConsultantActions({
  consultantId,
  status,
  canApprove,
}: {
  consultantId: number;
  status: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject" | "suspend", reason?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/consultants/${consultantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در انجام عملیات");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onReject() {
    const reason = window.prompt("دلیل رد مشاور را وارد کنید:");
    if (!reason?.trim()) return;
    run("reject", reason.trim());
  }

  function onSuspend() {
    const reason = window.prompt("دلیل تعلیق مشاور را وارد کنید:");
    if (!reason?.trim()) return;
    run("suspend", reason.trim());
  }

  if (!canApprove) return null;

  return (
    <div className="admin-inline-form">
      {error && <p style={{ color: "#991b1b" }}>{error}</p>}
      {(status === "pending" || status === "rejected" || status === "suspended") && (
        <button className="btn-primary" disabled={busy} onClick={() => run("approve")}>
          تأیید
        </button>
      )}
      {status === "pending" && (
        <button className="btn-danger" disabled={busy} onClick={onReject}>
          رد
        </button>
      )}
      {status === "approved" && (
        <button className="btn-danger" disabled={busy} onClick={onSuspend}>
          تعلیق
        </button>
      )}
    </div>
  );
}

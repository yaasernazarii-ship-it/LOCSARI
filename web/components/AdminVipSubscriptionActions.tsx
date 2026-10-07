"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminVipSubscriptionActions({ subscriptionId, status }: { subscriptionId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject", reason?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vip-subscriptions/${subscriptionId}`, {
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
    const reason = window.prompt("دلیل رد درخواست را وارد کنید:");
    if (!reason?.trim()) return;
    run("reject", reason.trim());
  }

  if (status !== "pending") return null;

  return (
    <div className="admin-inline-form">
      {error && <p style={{ color: "#991b1b" }}>{error}</p>}
      <button className="btn-primary" disabled={busy} onClick={() => run("approve")}>
        تأیید
      </button>
      <button className="btn-danger" disabled={busy} onClick={onReject}>
        رد
      </button>
    </div>
  );
}

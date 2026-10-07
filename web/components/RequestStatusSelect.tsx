"use client";

// تغییر وضعیت یک درخواست تماس/بازدید — فقط برای مالک آگهی (دریافت‌کنندهٔ درخواست) نمایش داده می‌شود.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REQUEST_STATUS_LABELS } from "@/lib/labels";
import { REQUEST_STATUSES } from "@/lib/validation";

export default function RequestStatusSelect({ requestId, status }: { requestId: number; status: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onChange(newStatus: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/account/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در تغییر وضعیت");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در تغییر وضعیت");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="request-status-select">
      <select value={status} disabled={saving} onChange={(e) => onChange(e.target.value)}>
        {REQUEST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {REQUEST_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="my-ad__error">{error}</span>}
    </div>
  );
}

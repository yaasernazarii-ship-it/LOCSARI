"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS } from "@/lib/labels";

type Consultant = { id: number; display_name: string };

// فرم درون‌ردیفی تعیین مشاور مسئول پیگیریِ یک آگهی VIP + مشاهدهٔ وضعیت/نتیجهٔ کار (ادمین)
export default function AdminVipAdAssignmentForm({
  advertisementId,
  consultants,
  consultantId,
  status,
  resultNote,
}: {
  advertisementId: number;
  consultants: Consultant[];
  consultantId: number | null;
  status: string;
  resultNote: string | null;
}) {
  const router = useRouter();
  const [selectedConsultant, setSelectedConsultant] = useState<string>(consultantId ? String(consultantId) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vip-ads/${advertisementId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId: selectedConsultant ? Number(selectedConsultant) : null, status }),
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

  return (
    <>
      <td>
        <select value={selectedConsultant} onChange={(e) => setSelectedConsultant(e.target.value)} disabled={busy}>
          <option value="">— تعیین نشده —</option>
          {consultants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <button className="btn-primary" type="button" disabled={busy} onClick={assign} style={{ marginRight: 8 }}>
          ثبت
        </button>
        {error && <p style={{ color: "#991b1b", marginTop: 4 }}>{error}</p>}
      </td>
      <td>
        <span className={`status-badge status-badge--${status}`}>{TASK_STATUS_LABELS[status] ?? status}</span>
      </td>
      <td>{resultNote || <span style={{ color: "#999" }}>—</span>}</td>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminVipPlanToggle({ planId, isActive }: { planId: number; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vip-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={isActive ? "btn-danger" : "btn-primary"} disabled={busy} onClick={toggle}>
      {isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
    </button>
  );
}

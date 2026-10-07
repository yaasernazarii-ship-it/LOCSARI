"use client";

// نمایش‌دهندهٔ سراسری Toast های پنل مدیریت — یک‌بار در admin/layout.tsx mount می‌شود.

import { useEffect, useState } from "react";
import type { ToastType } from "@/lib/adminToast";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 1;

export default function AdminToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      if (!detail) return;
      const id = nextId++;
      setToasts((t) => [...t, { id, message: detail.message, type: detail.type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }
    window.addEventListener("admin-toast", onToast);
    return () => window.removeEventListener("admin-toast", onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="admin-toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`admin-toast admin-toast--${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

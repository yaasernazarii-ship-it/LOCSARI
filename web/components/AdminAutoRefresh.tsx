"use client";

// به‌روزرسانی خودکار سبک (polling) برای پنل مدیریت — هر چند ثانیه یک‌بار router.refresh()
// را صدا می‌زند تا داده‌های سرور (شمارنده‌های منو، لیست‌ها، جدول‌ها) بدون رفرش کامل صفحه
// به‌روز شوند. فقط وقتی تب در حال نمایش است polling فعال می‌ماند تا بار اضافی روی سرور
// وارد نشود. هیچ اتصال Websocket/SSE جدیدی اضافه نمی‌شود؛ صرفاً از قابلیت موجود Next.js
// (Server Component refetch) استفاده می‌شود.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AdminAutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        routerRef.current.refresh();
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return null;
}

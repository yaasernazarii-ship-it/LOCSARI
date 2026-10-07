"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloaded = false;

    // وقتی نسخهٔ جدید Service Worker جایگزین نسخهٔ قبلی می‌شود (بعد از هر دیپلوی)،
    // صفحهٔ باز کاربر باید یک‌بار خودکار رفرش شود تا کدِ تازه فوراً لود شود
    // (بدون این، کاربر مجبور بود دستی رفرش کند تا سایت به‌روز شود).
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        registration.update().catch(() => {});
      } catch {
        // ثبت service worker اختیاری است؛ در صورت شکست، سایت به‌صورت عادی کار می‌کند.
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    // بررسی دوره‌ای برای نسخهٔ جدید هنگام برگشت کاربر به تب (چون مرورگرها بررسی خودکار SW را
    // تا ۲۴ ساعت به تعویق می‌اندازند و منتظر نمی‌مانیم)
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => registration?.update().catch(() => {}), 5 * 60 * 1000);

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

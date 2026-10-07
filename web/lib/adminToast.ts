// انتشار Toast سبک در پنل مدیریت به‌جای window.alert — بدون نیاز به Context/Provider سراسری.
// هر کامپوننت کلاینت با فراخوانی showToast یک رویداد سفارشی منتشر می‌کند؛ AdminToastHost آن را نمایش می‌دهد.

export type ToastType = "success" | "error";

export function showToast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message, type } }));
}

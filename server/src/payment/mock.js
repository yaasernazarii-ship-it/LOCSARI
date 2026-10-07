// درگاه آزمایشی — تا زمان دریافت اطلاعات درگاه واقعی (مثل زرین‌پال) از این استفاده می‌شود.
// همان قرارداد (createPayment / verifyCallback) درگاه واقعی را رعایت می‌کند تا جایگزینی بدون تغییر بقیه کد ممکن باشد.

function createPayment(order, baseUrl) {
  // به‌جای ریدایرکت به بانک واقعی، به صفحه شبیه‌سازی پرداخت داخلی می‌رویم
  return Promise.resolve({
    redirectUrl: `${baseUrl}/api/payment/mock/${order.id}`,
    providerRef: `MOCK-${order.id}`,
  });
}

// در حالت mock تأیید تراکنش مستقیماً توسط کاربر از صفحه شبیه‌سازی انجام می‌شود
// (فایل routes/payment.js مسیر callback مخصوص mock را جدا مدیریت می‌کند)
function verifyCallback() {
  return Promise.resolve({ ok: false, reason: "درگاه آزمایشی از این متد استفاده نمی‌کند" });
}

module.exports = { createPayment, verifyCallback };

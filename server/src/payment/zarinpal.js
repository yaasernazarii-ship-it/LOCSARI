// درگاه زرین‌پال — به محض دریافت «مرچنت کد» از کاربر و تنظیم آن در فایل .env سرور
// (متغیر ZARINPAL_MERCHANT_ID) این درگاه بدون نیاز به تغییر بقیه کد فعال می‌شود.
// مستندات: https://docs.zarinpal.com/paymentGateway/

const REQUEST_URL = "https://api.zarinpal.com/pg/v4/payment/request.json";
const VERIFY_URL = "https://api.zarinpal.com/pg/v4/payment/verify.json";
const STARTPAY_URL = "https://www.zarinpal.com/pg/StartPay/";

function isConfigured() {
  return Boolean(process.env.ZARINPAL_MERCHANT_ID);
}

async function createPayment(order) {
  if (!isConfigured()) {
    throw new Error(
      "درگاه زرین‌پال هنوز پیکربندی نشده — منتظر دریافت مرچنت کد از کارفرما"
    );
  }
  const res = await fetch(REQUEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: process.env.ZARINPAL_MERCHANT_ID,
      amount: order.amount, // به تومان (v4 زرین‌پال ریال می‌خواهد، تبدیل لازم است)
      callback_url: process.env.ZARINPAL_CALLBACK_URL,
      description: order.description || "ویژه‌سازی آگهی — لوکیشن ساری",
    }),
  });
  const data = await res.json();
  if (data.data && data.data.code === 100) {
    return {
      redirectUrl: STARTPAY_URL + data.data.authority,
      providerRef: data.data.authority,
    };
  }
  throw new Error(
    "خطا در ایجاد تراکنش زرین‌پال: " +
      JSON.stringify((data.errors && data.errors) || data)
  );
}

async function verifyCallback(query, order) {
  if (!isConfigured()) {
    return { ok: false, reason: "درگاه زرین‌پال پیکربندی نشده است" };
  }
  if (query.Status !== "OK") {
    return { ok: false, reason: "پرداخت توسط کاربر لغو شد" };
  }
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: process.env.ZARINPAL_MERCHANT_ID,
      amount: order.amount,
      authority: query.Authority,
    }),
  });
  const data = await res.json();
  if (data.data && (data.data.code === 100 || data.data.code === 101)) {
    return { ok: true, refId: data.data.ref_id };
  }
  return { ok: false, reason: "تأیید تراکنش ناموفق بود" };
}

module.exports = { createPayment, verifyCallback, isConfigured };

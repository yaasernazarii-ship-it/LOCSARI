// انتخاب درگاه پرداخت فعال بر اساس متغیر محیطی PAYMENT_PROVIDER
// وقتی اطلاعات درگاه واقعی (مثلاً زرین‌پال) دریافت شد، فقط کافیست
// در فایل .env سرور مقدار PAYMENT_PROVIDER=zarinpal و ZARINPAL_MERCHANT_ID تنظیم شود.
const mock = require("./mock");
const zarinpal = require("./zarinpal");

function getProvider() {
  const name = process.env.PAYMENT_PROVIDER || "mock";
  if (name === "zarinpal") return zarinpal;
  return mock;
}

module.exports = { getProvider };

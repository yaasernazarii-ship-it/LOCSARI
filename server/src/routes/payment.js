const express = require("express");
const { db, persist } = require("../store");
const { getProvider } = require("../payment");
const { createNotification } = require("../notify");
const { PACKAGES } = require("./boost");

const router = express.Router();

function applyBoostSuccess(order) {
  const pkg = PACKAGES.find((p) => p.id === order.packageId);
  const listing = db.listings.find((l) => l.id === order.listingId);
  if (!pkg || !listing) return;
  const expires = new Date();
  expires.setDate(expires.getDate() + pkg.days);
  listing.boostExpiresAt = expires.toISOString();
  if (pkg.badge === "featured") listing.featured = true;
  if (pkg.badge === "urgent") listing.urgent = true;
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  persist();
  createNotification(
    order.userId,
    "boost",
    `پرداخت «${pkg.title}» برای آگهی «${listing.title}» با موفقیت انجام شد`,
    listing.id
  );
}

// ---------- صفحه شبیه‌سازی پرداخت (فقط تا زمان اتصال درگاه واقعی) ----------
router.get("/mock/:orderId", (req, res) => {
  const order = db.boostOrders.find((o) => o.id === Number(req.params.orderId));
  if (!order) return res.status(404).send("سفارش یافت نشد");
  const pkg = PACKAGES.find((p) => p.id === order.packageId);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="UTF-8" />
<title>پرداخت آزمایشی — لوکیشن ساری</title>
<style>
body{font-family:Tahoma,sans-serif;background:#f4f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:14px;padding:32px;max-width:380px;width:90%;box-shadow:0 6px 24px rgba(0,0,0,.08);text-align:center}
h2{margin-top:0}
.amount{font-size:1.4rem;font-weight:bold;color:#2d9d68;margin:16px 0}
button{width:100%;padding:12px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;margin-top:10px}
.pay{background:#2d9d68;color:#fff}
.cancel{background:#eee;color:#333}
.note{color:#999;font-size:.8rem;margin-top:18px}
</style></head>
<body>
<div class="card">
  <h2>درگاه پرداخت آزمایشی</h2>
  <p>${pkg ? pkg.title : ""}</p>
  <div class="amount">${order.amount.toLocaleString("fa-IR")} تومان</div>
  <form method="POST" action="/api/payment/mock-callback">
    <input type="hidden" name="orderId" value="${order.id}" />
    <button class="pay" name="result" value="success" type="submit">پرداخت موفق (تستی)</button>
    <button class="cancel" name="result" value="cancel" type="submit">انصراف</button>
  </form>
  <p class="note">این یک صفحه شبیه‌سازی‌شده است. درگاه واقعی پس از دریافت اطلاعات بانکی از کارفرما جایگزین می‌شود.</p>
</div>
</body></html>`);
});

router.post(
  "/mock-callback",
  express.urlencoded({ extended: false }),
  (req, res) => {
    const order = db.boostOrders.find(
      (o) => o.id === Number(req.body.orderId)
    );
    if (!order) return res.status(404).send("سفارش یافت نشد");
    if (req.body.result === "success" && order.status === "pending") {
      applyBoostSuccess(order);
      return res.redirect(
        `/property.html?id=${order.listingId}&payment=success`
      );
    }
    order.status = "failed";
    persist();
    res.redirect(`/property.html?id=${order.listingId}&payment=failed`);
  }
);

// ---------- بازگشت از درگاه زرین‌پال (پس از فعال‌سازی) ----------
router.get("/zarinpal/callback", async (req, res) => {
  const authority = req.query.Authority;
  const order = db.boostOrders.find((o) => o.providerRef === authority);
  if (!order) return res.status(404).send("سفارش یافت نشد");
  try {
    const result = await getProvider().verifyCallback(req.query, order);
    if (result.ok) {
      applyBoostSuccess(order);
      return res.redirect(
        `/property.html?id=${order.listingId}&payment=success`
      );
    }
  } catch (e) {
    // ادامه به مسیر شکست
  }
  order.status = "failed";
  persist();
  res.redirect(`/property.html?id=${order.listingId}&payment=failed`);
});

module.exports = router;

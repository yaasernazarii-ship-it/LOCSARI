const express = require("express");
const { db, persist, nextId } = require("../store");
const { requireAuth } = require("../auth");
const { getProvider } = require("../payment");

const router = express.Router();

const PACKAGES = [
  { id: "featured-7", title: "آگهی ویژه ۷ روزه", badge: "featured", days: 7, price: 300000 },
  { id: "featured-30", title: "آگهی ویژه ۳۰ روزه", badge: "featured", days: 30, price: 900000 },
  { id: "urgent-7", title: "آگهی فوری ۷ روزه", badge: "urgent", days: 7, price: 200000 },
  { id: "urgent-30", title: "آگهی فوری ۳۰ روزه", badge: "urgent", days: 30, price: 600000 },
];

router.get("/packages", (req, res) => {
  res.json({ packages: PACKAGES });
});

router.post("/orders", requireAuth, async (req, res) => {
  const { listingId, packageId } = req.body || {};
  const listing = db.listings.find((l) => l.id === Number(listingId));
  if (!listing) return res.status(404).json({ error: "آگهی یافت نشد" });
  if (listing.ownerId !== req.userId) {
    return res.status(403).json({ error: "فقط مالک آگهی می‌تواند آن را ویژه کند" });
  }
  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return res.status(400).json({ error: "بسته انتخابی نامعتبر است" });

  const order = {
    id: nextId("boostOrders"),
    listingId: listing.id,
    userId: req.userId,
    packageId: pkg.id,
    amount: pkg.price,
    status: "pending",
    provider: process.env.PAYMENT_PROVIDER || "mock",
    providerRef: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  db.boostOrders.push(order);
  persist();

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  try {
    const result = await getProvider().createPayment(
      { ...order, description: pkg.title },
      baseUrl
    );
    order.providerRef = result.providerRef;
    persist();
    res.status(201).json({ order, redirectUrl: result.redirectUrl });
  } catch (e) {
    order.status = "failed";
    persist();
    res.status(502).json({ error: e.message });
  }
});

module.exports = { router, PACKAGES };

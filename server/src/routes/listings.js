const express = require("express");
const fs = require("fs");
const path = require("path");
const { db, persist, nextId } = require("../store");
const { requireAuth, optionalAuth } = require("../auth");

const router = express.Router();

const meta = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "seed-listings.json"), "utf8")
);
const VALID_TYPES = Object.keys(meta.PROPERTY_TYPES);
const VALID_NEIGHBORHOODS = meta.NEIGHBORHOODS;

function expireOldBoosts() {
  const now = Date.now();
  let changed = false;
  for (const l of db.listings) {
    if (l.boostExpiresAt && new Date(l.boostExpiresAt).getTime() < now) {
      l.boostExpiresAt = null;
      l.featured = false;
      l.urgent = false;
      changed = true;
    }
  }
  if (changed) persist();
}

router.get("/", optionalAuth, (req, res) => {
  expireOldBoosts();
  res.json({ listings: db.listings.filter((l) => l.status === "active") });
});

router.get("/mine", requireAuth, (req, res) => {
  res.json({
    listings: db.listings.filter((l) => l.ownerId === req.userId),
  });
});

router.get("/:id", optionalAuth, (req, res) => {
  expireOldBoosts();
  const listing = db.listings.find((l) => l.id === Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "آگهی یافت نشد" });
  res.json({ listing });
});

router.post("/", requireAuth, (req, res) => {
  const b = req.body || {};
  if (!VALID_TYPES.includes(b.type)) {
    return res.status(400).json({ error: "نوع ملک نامعتبر است" });
  }
  if (!VALID_NEIGHBORHOODS.includes(b.neighborhood)) {
    return res
      .status(400)
      .json({ error: "این سایت فقط محله‌های داخل شهر ساری را می‌پذیرد" });
  }
  if (!b.title || !b.title.trim()) {
    return res.status(400).json({ error: "عنوان آگهی الزامی است" });
  }
  if (!["sale", "rent"].includes(b.dealType)) {
    return res.status(400).json({ error: "نوع معامله نامعتبر است" });
  }
  const area = Number(b.area);
  if (!area || area <= 0) {
    return res.status(400).json({ error: "متراژ معتبر وارد کنید" });
  }

  const now = new Date().toISOString().slice(0, 10);
  const listing = {
    id: nextId("listings"),
    title: b.title.trim(),
    type: b.type,
    dealType: b.dealType,
    neighborhood: b.neighborhood,
    area,
    rooms: Number(b.rooms) || 0,
    yearBuilt: b.yearBuilt ? Number(b.yearBuilt) : null,
    price: b.dealType === "sale" ? Number(b.price) || 0 : Number(b.deposit) || 0,
    monthlyRent: b.dealType === "rent" ? Number(b.monthlyRent) || 0 : 0,
    elevator: Boolean(b.elevator),
    parking: Boolean(b.parking),
    warehouse: Boolean(b.warehouse),
    description: (b.description || "").trim(),
    featured: false,
    urgent: false,
    createdAt: now,
    updatedAt: now,
    views: 0,
    ownerId: req.userId,
    status: "active",
    boostExpiresAt: null,
  };
  db.listings.push(listing);
  persist();
  res.status(201).json({ listing });
});

router.patch("/:id", requireAuth, (req, res) => {
  const listing = db.listings.find((l) => l.id === Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "آگهی یافت نشد" });
  if (listing.ownerId !== req.userId) {
    return res.status(403).json({ error: "شما مالک این آگهی نیستید" });
  }
  const editable = [
    "title",
    "price",
    "monthlyRent",
    "description",
    "rooms",
    "area",
    "elevator",
    "parking",
    "warehouse",
  ];
  for (const key of editable) {
    if (key in req.body) listing[key] = req.body[key];
  }
  listing.updatedAt = new Date().toISOString().slice(0, 10);
  persist();
  res.json({ listing });
});

router.delete("/:id", requireAuth, (req, res) => {
  const listing = db.listings.find((l) => l.id === Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "آگهی یافت نشد" });
  if (listing.ownerId !== req.userId) {
    return res.status(403).json({ error: "شما مالک این آگهی نیستید" });
  }
  listing.status = "deleted";
  persist();
  res.json({ ok: true });
});

router.post("/:id/view", (req, res) => {
  const listing = db.listings.find((l) => l.id === Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "آگهی یافت نشد" });
  listing.views = (listing.views || 0) + 1;
  persist();
  res.json({ views: listing.views });
});

module.exports = router;

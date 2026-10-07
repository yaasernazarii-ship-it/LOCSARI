const express = require("express");
const { db, persist } = require("../store");
const { requireAuth } = require("../auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const list = db.notifications
    .filter((n) => n.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ notifications: list });
});

router.post("/:id/read", requireAuth, (req, res) => {
  const n = db.notifications.find(
    (x) => x.id === Number(req.params.id) && x.userId === req.userId
  );
  if (!n) return res.status(404).json({ error: "اعلان یافت نشد" });
  n.read = true;
  persist();
  res.json({ ok: true });
});

router.post("/read-all", requireAuth, (req, res) => {
  db.notifications
    .filter((n) => n.userId === req.userId)
    .forEach((n) => (n.read = true));
  persist();
  res.json({ ok: true });
});

module.exports = router;

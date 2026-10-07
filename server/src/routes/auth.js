const express = require("express");
const { db, persist, nextId } = require("../store");
const {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
} = require("../auth");

const router = express.Router();

const PHONE_RE = /^09\d{9}$/;

function publicUser(u) {
  return { id: u.id, phone: u.phone, name: u.name, createdAt: u.createdAt };
}

router.post("/register", (req, res) => {
  const { phone, password, name } = req.body || {};
  if (!phone || !PHONE_RE.test(phone)) {
    return res
      .status(400)
      .json({ error: "شماره موبایل معتبر نیست (مثال: 09xxxxxxxxx)" });
  }
  if (!password || password.length < 6) {
    return res
      .status(400)
      .json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "نام را وارد کنید" });
  }
  if (db.users.some((u) => u.phone === phone)) {
    return res
      .status(409)
      .json({ error: "کاربری با این شماره موبایل قبلاً ثبت‌نام کرده است" });
  }
  const user = {
    id: nextId("users"),
    phone,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  persist();
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const { phone, password } = req.body || {};
  const user = db.users.find((u) => u.phone === phone);
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "شماره موبایل یا رمز عبور اشتباه است" });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "کاربر یافت نشد" });
  res.json({ user: publicUser(user) });
});

module.exports = router;

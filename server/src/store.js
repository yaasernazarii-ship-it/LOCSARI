// ذخیره‌ساز ساده مبتنی بر فایل JSON — بدون نیاز به دیتابیس یا ماژول native
// مناسب برای حجم داده و ترافیک یک سایت تخصصی تک‌شهری (لوکیشن ساری)
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const SEED_FILE = path.join(__dirname, "seed-listings.json");

function emptyDb() {
  return {
    users: [],
    listings: [],
    chats: [],
    messages: [],
    notifications: [],
    boostOrders: [],
    seq: {
      users: 0,
      listings: 0,
      chats: 0,
      messages: 0,
      notifications: 0,
      boostOrders: 0,
    },
  };
}

function loadInitial() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (e) {
      console.error("خطا در خواندن db.json، ساخت دیتابیس جدید:", e.message);
    }
  }
  // اولین اجرا: seed از ۲۰ آگهی نمونه سایت
  const db = emptyDb();
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    db.listings = seed.LISTINGS.map((l) => ({
      ...l,
      ownerId: null, // آگهی‌های اولیه سایت، بدون مالک حساب کاربری
      status: "active",
      boostExpiresAt: null,
    }));
    db.seq.listings = Math.max(0, ...db.listings.map((l) => l.id));
  } catch (e) {
    console.error("خطا در seed اولیه آگهی‌ها:", e.message);
  }
  return db;
}

let db = loadInitial();
let writeQueue = Promise.resolve();

function persist() {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve) => {
        const tmp = DB_FILE + ".tmp";
        fs.writeFile(tmp, JSON.stringify(db, null, 2), (err) => {
          if (err) {
            console.error("خطا در ذخیره db.json:", err.message);
            return resolve();
          }
          fs.rename(tmp, DB_FILE, (err2) => {
            if (err2) console.error("خطا در جابجایی db.json:", err2.message);
            resolve();
          });
        });
      })
  );
  return writeQueue;
}

function nextId(collection) {
  db.seq[collection] += 1;
  return db.seq[collection];
}

module.exports = {
  db,
  persist,
  nextId,
};

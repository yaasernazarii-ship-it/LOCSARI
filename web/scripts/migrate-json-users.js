// مهاجرت یک‌بارهٔ کاربران از دیتابیس JSON فعلی (server/data/db.json) به Postgres
// این اسکریپت فقط users را منتقل می‌کند و به db.json دست نمی‌زند (Backward Compatibility).
// قانون ثابت پروژه: پیش از هر migration که db.json را می‌خواند، حتماً یک نسخهٔ backup
// با timestamp از آن گرفته می‌شود، چون db.json تنها منبع دیتای واقعی سایت فعلی است.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const JSON_DB_PATH = path.join(__dirname, "..", "..", "server", "data", "db.json");
const BACKUP_DIR = path.join(__dirname, "..", "..", "server", "data", "backups");

function backupJsonDb() {
  if (!fs.existsSync(JSON_DB_PATH)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `db-${timestamp}.json`);
  fs.copyFileSync(JSON_DB_PATH, backupPath);
  console.log(`Backup گرفته شد: ${backupPath}`);
  return backupPath;
}

async function main() {
  const backupPath = backupJsonDb();
  if (!fs.existsSync(JSON_DB_PATH)) {
    console.log("فایل db.json پیدا نشد (هنوز کاربری در سایت فعلی ثبت نشده)؛ چیزی برای مهاجرت نیست.");
    return;
  }
  const jsonDb = JSON.parse(fs.readFileSync(JSON_DB_PATH, "utf8"));
  const jsonUsers = jsonDb.users || [];
  console.log(`تعداد کاربران در db.json: ${jsonUsers.length}`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const roleRes = await client.query("select id from roles where key = 'user'");
  if (!roleRes.rowCount) throw new Error("نقش 'user' در Postgres یافت نشد؛ ابتدا migrate را اجرا کنید.");
  const userRoleId = roleRes.rows[0].id;

  let migrated = 0;
  let skipped = 0;

  for (const u of jsonUsers) {
    const exists = await client.query("select id from users where phone = $1", [u.phone]);
    if (exists.rowCount) {
      skipped++;
      continue;
    }
    const inserted = await client.query(
      `insert into users (name, phone, password_hash, created_at) values ($1, $2, $3, $4) returning id`,
      [u.name, u.phone, u.passwordHash, u.createdAt || new Date().toISOString()]
    );
    const newId = inserted.rows[0].id;
    await client.query(
      `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
      [newId, userRoleId]
    );
    migrated++;
  }

  const countRes = await client.query("select count(*) from users");
  console.log(`مهاجرت انجام شد. جدید: ${migrated} — تکراری/رد شده: ${skipped}`);
  console.log(`تعداد کل کاربران در db.json: ${jsonUsers.length} — تعداد کل کاربران در Postgres پس از مهاجرت: ${countRes.rows[0].count}`);

  await client.end();
}

main().catch((err) => {
  console.error("خطا در مهاجرت کاربران:", err);
  process.exit(1);
});

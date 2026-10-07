// اجرای فایل‌های migrations/*.sql به ترتیب، با ردیابی در جدول schema_migrations
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { readdirSync, readFileSync } = require("fs");
const { join } = require("path");
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    create table if not exists schema_migrations (
      filename varchar(200) primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const dir = join(__dirname, "..", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = await client.query("select 1 from schema_migrations where filename = $1", [file]);
    if (already.rowCount) {
      console.log(`رد شد (قبلاً اجرا شده): ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    console.log(`در حال اجرا: ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`انجام شد: ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }

  await client.end();
  console.log("همهٔ Migrationها اعمال شدند.");
}

main().catch((err) => {
  console.error("خطا در اجرای migration:", err);
  process.exit(1);
});

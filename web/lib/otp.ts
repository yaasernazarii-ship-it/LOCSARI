// فاز ۱.۲ — منطق تولید/بررسی کد OTP (مستقل از SMS.ir، فقط دیتابیس و رمزنگاری)
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { db } from "./db";
import type { OtpPurpose } from "./auth";

export const OTP_CODE_LENGTH = 5;
export const OTP_TTL_MS = 2 * 60 * 1000; // ۲ دقیقه
export const OTP_MAX_ATTEMPTS = 5; // بعد از این تعداد تلاش نادرست، کد قفل می‌شود و باید کد جدید درخواست شود

export function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_CODE_LENGTH, "0");
}

/** یک چالش OTP جدید در دیتابیس ثبت می‌کند و خود کد (plaintext) را برای ارسال پیامک برمی‌گرداند. کد هرگز ذخیره نمی‌شود، فقط hash آن. */
export async function createOtpChallenge(phone: string, purpose: OtpPurpose, ip: string | null): Promise<string> {
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  await db
    .insertInto("otp_codes")
    .values({
      phone,
      purpose,
      code_hash: codeHash,
      ip,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })
    .execute();
  return code;
}

export type OtpVerifyResult = "ok" | "invalid" | "expired";

/** آخرین چالش فعال (مصرف‌نشده) همان phone+purpose را با کد ورودی مقایسه می‌کند. تک‌مصرفی: در صورت موفقیت، بلافاصله consumed می‌شود. */
export async function verifyOtpChallenge(phone: string, purpose: OtpPurpose, code: string): Promise<OtpVerifyResult> {
  const row = await db
    .selectFrom("otp_codes")
    .selectAll()
    .where("phone", "=", phone)
    .where("purpose", "=", purpose)
    .where("consumed_at", "is", null)
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  // اگر چالشی پیدا نشود (مثلاً برای password_reset روی شماره‌ای بدون حساب که هرگز کدی برایش صادر نشده)،
  // عمداً همان خطای «کد نادرست» برگردانده می‌شود تا وجود/عدم‌وجود حساب فاش نشود.
  if (!row) return "invalid";
  if (row.expires_at.getTime() < Date.now()) return "expired";
  if (row.attempts >= OTP_MAX_ATTEMPTS) return "expired"; // قفل‌شده؛ از دید کاربر معادل نیاز به کد جدید است

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    await db
      .updateTable("otp_codes")
      .set({ attempts: row.attempts + 1 })
      .where("id", "=", row.id)
      .execute();
    return "invalid";
  }

  await db
    .updateTable("otp_codes")
    .set({ consumed_at: new Date().toISOString() })
    .where("id", "=", row.id)
    .execute();
  return "ok";
}

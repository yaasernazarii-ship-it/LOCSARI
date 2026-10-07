import { cookies } from "next/headers";
import { verifySessionToken } from "./auth";
import { db } from "./db";

const COOKIE_NAME = "ls_session";

export async function getCurrentUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const verified = await verifySessionToken(token);
  if (!verified) return null;
  // اگر بعد از صدور این توکن، رمز عبور کاربر تغییر کرده باشد (بازیابی رمز، فاز ۱.۲)،
  // نشست قدیمی دیگر معتبر نیست — «در صورت امکان» طبق الزام invalidate کردن نشست‌های قبلی.
  const row = await db
    .selectFrom("users")
    .select(["password_changed_at"])
    .where("id", "=", verified.userId)
    .executeTakeFirst();
  if (!row) return null;
  if (row.password_changed_at && verified.issuedAt * 1000 < row.password_changed_at.getTime()) return null;
  return verified.userId;
}

export async function getCurrentUser() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const user = await db
    .selectFrom("users")
    .select(["id", "name", "phone", "status", "created_at"])
    .where("id", "=", userId)
    .where("status", "=", "active")
    .executeTakeFirst();
  return user ?? null;
}

export { COOKIE_NAME };

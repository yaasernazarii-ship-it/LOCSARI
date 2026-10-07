import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isValidIranianPhone, signSessionToken, verifyOtpTicket } from "@/lib/auth";
import { assignDefaultRole } from "@/lib/rbac";
import { COOKIE_NAME } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isNonEmptyString } from "@/lib/validation";

// POST /api/auth/login/otp — ورود کاربر عادی با کد پیامکی؛ اگر حساب وجود نداشته باشد، با دریافت نام
// همان‌جا ساخته می‌شود (ثبت‌نام و ورود کاربر عادی جهت ثبت آگهی فقط از طریق پیامک، بدون رمز عبور).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const otpTicket = typeof body?.otpTicket === "string" ? body.otpTicket : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!isValidIranianPhone(phone)) return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });

  if (!checkRateLimit(`login-otp:ip:${getClientIp(req)}`, 20, 60 * 60_000))
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  if (!otpTicket || !(await verifyOtpTicket(otpTicket, phone, "login")))
    return NextResponse.json({ error: "تأیید شمارهٔ موبایل نامعتبر یا منقضی شده است" }, { status: 400 });

  let user = await db
    .selectFrom("users")
    .select(["id", "name", "phone", "status"])
    .where("phone", "=", phone)
    .executeTakeFirst();

  if (!user) {
    // ticket هنوز معتبر است؛ اگر نام ارسال نشده باشد از کلاینت نام خواسته می‌شود (بدون نیاز به ارسال مجدد کد)
    if (!isNonEmptyString(name, 120)) return NextResponse.json({ needName: true });

    // کاربر عادی با پیامک ثبت‌نام می‌کند و رمز عبور ندارد؛ password_hash با مقدار تصادفی غیرقابل‌استفاده پر می‌شود
    // تا محدودیت NOT NULL دیتابیس حفظ شود (این کاربران هرگز از مسیر رمز عبور وارد نمی‌شوند).
    const randomPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
    const created = await db
      .insertInto("users")
      .values({ name, phone, password_hash: randomPasswordHash })
      .returning(["id", "name", "phone", "status"])
      .executeTakeFirstOrThrow();
    await assignDefaultRole(created.id, "user");
    user = created;
  }

  if (user.status !== "active") return NextResponse.json({ error: "حساب کاربری غیرفعال است" }, { status: 403 });

  const token = await signSessionToken(user.id);
  const res = NextResponse.json({ user: { id: user.id, name: user.name, phone: user.phone } });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

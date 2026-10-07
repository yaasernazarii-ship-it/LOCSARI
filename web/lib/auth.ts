import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const TOKEN_TTL = "12h"; // عمر کوتاه؛ چون Authorization هر بار از دیتابیس تازه‌سازی می‌شود، نیازی به عمر طولانی توکن نیست

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(JWT_SECRET);
}

/** issuedAt (ثانیهٔ یونیکس) برای امکان invalidate کردن نشست‌های صادرشده پیش از تغییر رمز عبور (بازیابی رمز، فاز ۱.۲) لازم است */
export async function verifySessionToken(token: string): Promise<{ userId: number; issuedAt: number } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const id = Number(payload.sub);
    if (!Number.isFinite(id) || typeof payload.iat !== "number") return null;
    return { userId: id, issuedAt: payload.iat };
  } catch {
    return null;
  }
}

const PHONE_REGEX = /^09\d{9}$/;

export function isValidIranianPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

// ---------- OTP Ticket (فاز ۱.۲) ----------
// بعد از تأیید موفق OTP، به‌جای نگه‌داشتن وضعیت «تأیید شده» در دیتابیس، یک توکن کوتاه‌عمر
// امضاشده صادر می‌شود که فقط برای همان شماره و همان purpose معتبر است. این توکن جایگزین ارسال
// مجدد کد در مرحلهٔ نهایی (تکمیل ثبت‌نام / تعیین رمز جدید) می‌شود.
export type OtpPurpose = "registration" | "password_reset" | "login";
const OTP_TICKET_TTL = "10m";
const OTP_TICKET_TYPE = "otp_ticket";

export async function signOtpTicket(phone: string, purpose: OtpPurpose): Promise<string> {
  return new SignJWT({ typ: OTP_TICKET_TYPE, phone, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(OTP_TICKET_TTL)
    .sign(JWT_SECRET);
}

/** فقط اگر ticket برای همان phone و همان purpose صادر شده و هنوز منقضی نشده باشد true برمی‌گرداند */
export async function verifyOtpTicket(token: string, phone: string, purpose: OtpPurpose): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.typ === OTP_TICKET_TYPE && payload.phone === phone && payload.purpose === purpose;
  } catch {
    return false;
  }
}

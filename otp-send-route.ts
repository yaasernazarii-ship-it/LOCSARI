import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidIranianPhone, type OtpPurpose } from "@/lib/auth";
import { createOtpChallenge } from "@/lib/otp";
import { sendOtpSms, isSmsConfigured } from "@/lib/sms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// POST /api/auth/otp/send — ارسال کد تأیید برای ثبت‌نام یا بازیابی رمز عبور (فاز ۱.۲)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const purpose = body?.purpose as OtpPurpose;

  if (!isValidIranianPhone(phone)) return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
  if (purpose !== "registration" && purpose !== "password_reset" && purpose !== "login")
    return NextResponse.json({ error: "purpose نامعتبر است" }, { status: 400 });

  const ip = getClientIp(req);
  // محدودیت نرخ ارسال: حداکثر ۳ بار در ۱۰ دقیقه برای هر شماره+purpose، و حداکثر ۱۰ بار در ساعت برای هر IP
  if (!checkRateLimit(`otp-send:phone:${phone}:${purpose}`, 3, 10 * 60_000))
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است. کمی بعد تلاش کنید" }, { status: 429 });
  if (!checkRateLimit(`otp-send:ip:${ip}`, 10, 60 * 60_000))
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است. کمی بعد تلاش کنید" }, { status: 429 });

  const existing = await db.selectFrom("users").select("id").where("phone", "=", phone).executeTakeFirst();

  if (purpose === "registration") {
    if (existing) return NextResponse.json({ error: "کاربری با این شماره موبایل قبلاً ثبت‌نام کرده است" }, { status: 409 });
  } else if (purpose === "password_reset" && !existing) {
    // password_reset روی شماره‌ای بدون حساب: برای جلوگیری از افشای وجود/عدم‌وجود حساب (phone enumeration)،
    // پاسخ موفق یکسان برمی‌گردد اما هیچ کد/پیامکی صادر نمی‌شود.
    return NextResponse.json({ ok: true });
  }
  // purpose === "login": چه حساب موجود باشد چه نه، کد همیشه ارسال می‌شود؛ این مسیر هم ورود و هم
  // ثبت‌نام خودکار کاربر عادی را پوشش می‌دهد (تصمیم محصول: بدون رمز عبور).

  if (!isSmsConfigured())
    return NextResponse.json({ error: "سرویس پیامک در حال حاضر پیکربندی نشده است" }, { status: 503 });

  const code = await createOtpChallenge(phone, purpose, ip === "unknown" ? null : ip);
  try {
    await sendOtpSms(phone, code);
  } catch {
    return NextResponse.json({ error: "ارسال پیامک ناموفق بود" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

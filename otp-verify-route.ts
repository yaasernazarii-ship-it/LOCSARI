import { NextRequest, NextResponse } from "next/server";
import { isValidIranianPhone, signOtpTicket, type OtpPurpose } from "@/lib/auth";
import { verifyOtpChallenge } from "@/lib/otp";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// POST /api/auth/otp/verify — بررسی کد OTP و صدور ticket کوتاه‌عمر برای مرحلهٔ نهایی (فاز ۱.۲)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const purpose = body?.purpose as OtpPurpose;
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!isValidIranianPhone(phone)) return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
  if (purpose !== "registration" && purpose !== "password_reset" && purpose !== "login")
    return NextResponse.json({ error: "purpose نامعتبر است" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "کد تأیید الزامی است" }, { status: 400 });

  const ip = getClientIp(req);
  // محدودیت نرخ بررسی کد: حداکثر ۱۰ بار در ۱۰ دقیقه برای هر شماره+purpose، و حداکثر ۳۰ بار در ساعت برای هر IP
  if (!checkRateLimit(`otp-verify:phone:${phone}:${purpose}`, 10, 10 * 60_000))
    return NextResponse.json({ error: "تعداد تلاش بیش از حد مجاز است" }, { status: 429 });
  if (!checkRateLimit(`otp-verify:ip:${ip}`, 30, 60 * 60_000))
    return NextResponse.json({ error: "تعداد تلاش بیش از حد مجاز است" }, { status: 429 });

  const result = await verifyOtpChallenge(phone, purpose, code);
  if (result !== "ok") {
    const message = result === "expired" ? "کد منقضی شده است، کد جدید درخواست کنید" : "کد وارد شده نادرست است";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ticket = await signOtpTicket(phone, purpose);
  return NextResponse.json({ ticket });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { createOtpChallenge } from "@/lib/otp";
import { sendOtpSms, isSmsConfigured } from "@/lib/sms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// POST /api/account/cip-contract/send — ارسال کد تأیید قرارداد CIP به شمارهٔ ثبت‌شدهٔ همان کاربر.
// شماره از نشست گرفته می‌شود، نه از ورودی، تا کد به شمارهٔ دیگری ارسال نشود.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!isSmsConfigured()) {
    return NextResponse.json({ error: "سرویس پیامک در حال حاضر پیکربندی نشده است" }, { status: 503 });
  }
  if (!checkRateLimit(`cip-contract-send:user:${auth.user.id}`, 5, 15 * 60_000) || !checkRateLimit(`cip-contract-send-ip:${getClientIp(req)}`, 20, 15 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است. کمی بعد تلاش کنید" }, { status: 429 });
  }

  const phone = auth.user.phone;
  const masked = `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  const code = await createOtpChallenge(phone, "cip_contract", getClientIp(req) === "unknown" ? null : getClientIp(req));
  try {
    await sendOtpSms(phone, code, 930574);
  } catch (error) {
    console.error("CIP contract OTP SMS delivery failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "ارسال پیامک ناموفق بود" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, phone: masked });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { verifyOtpChallenge } from "@/lib/otp";
import { signCipContractTicket } from "@/lib/cipContract";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// POST /api/account/cip-contract/verify — بررسی کد پیامک قرارداد و صدور بلیت کوتاه‌عمر برای پرداخت.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!checkRateLimit(`cip-contract-verify:user:${auth.user.id}`, 10, 10 * 60_000) || !checkRateLimit(`cip-contract-verify-ip:${getClientIp(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.replace(/[۰-۹]/g, (digit: string) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).trim() : "";
  if (!/^\d{5}$/.test(code)) return NextResponse.json({ error: "کد تأیید را به‌صورت ۵ رقمی وارد کنید" }, { status: 400 });

  const result = await verifyOtpChallenge(auth.user.phone, "cip_contract", code);
  if (result === "expired") {
    return NextResponse.json({ error: "کد منقضی شده است؛ کد جدید دریافت کنید" }, { status: 400 });
  }
  if (result !== "ok") {
    return NextResponse.json({ error: "کد تأیید نادرست است" }, { status: 400 });
  }
  const ticket = await signCipContractTicket(auth.user.id);
  return NextResponse.json({ ok: true, ticket });
}

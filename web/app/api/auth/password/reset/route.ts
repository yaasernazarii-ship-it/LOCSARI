import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isValidIranianPhone, verifyOtpTicket } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// POST /api/auth/password/reset — تعیین رمز عبور جدید پس از تأیید OTP بازیابی رمز (فاز ۱.۲)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const otpTicket = typeof body?.otpTicket === "string" ? body.otpTicket : "";

  if (!isValidIranianPhone(phone)) return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });

  if (!checkRateLimit(`password-reset:ip:${getClientIp(req)}`, 10, 60 * 60_000))
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  if (!otpTicket || !(await verifyOtpTicket(otpTicket, phone, "password_reset")))
    return NextResponse.json({ error: "تأیید شمارهٔ موبایل نامعتبر یا منقضی شده است" }, { status: 400 });

  const passwordHash = await hashPassword(password);
  const result = await db
    .updateTable("users")
    .set({ password_hash: passwordHash, password_changed_at: new Date().toISOString() })
    .where("phone", "=", phone)
    .executeTakeFirst();

  // در حالت عادی چون ticket فقط برای شمارهٔ دارای حساب صادر می‌شود، این حالت رخ نمی‌دهد
  if (!result.numUpdatedRows) return NextResponse.json({ error: "کاربری با این شماره یافت نشد" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isValidIranianPhone, signSessionToken, verifyOtpTicket } from "@/lib/auth";
import { assignDefaultRole } from "@/lib/rbac";
import { COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const otpTicket = typeof body?.otpTicket === "string" ? body.otpTicket : "";

  if (!name) return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
  if (!isValidIranianPhone(phone))
    return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
  // تأیید شمارهٔ موبایل با OTP الزامی است (فاز ۱.۲) — ticket فقط برای همین شماره و همین purpose معتبر است
  if (!otpTicket || !(await verifyOtpTicket(otpTicket, phone, "registration")))
    return NextResponse.json({ error: "تأیید شمارهٔ موبایل نامعتبر یا منقضی شده است" }, { status: 400 });

  const existing = await db.selectFrom("users").select("id").where("phone", "=", phone).executeTakeFirst();
  if (existing)
    return NextResponse.json({ error: "کاربری با این شماره موبایل قبلاً ثبت‌نام کرده است" }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await db
    .insertInto("users")
    .values({ name, phone, password_hash: passwordHash })
    .returning(["id", "name", "phone", "created_at"])
    .executeTakeFirstOrThrow();

  await assignDefaultRole(user.id, "user");

  const token = await signSessionToken(user.id);
  const res = NextResponse.json({ user: { id: user.id, name: user.name, phone: user.phone } }, { status: 201 });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

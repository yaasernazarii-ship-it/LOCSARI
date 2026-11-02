import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signSessionToken, isValidIranianPhone } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidIranianPhone(phone) || !password) {
    return NextResponse.json({ error: "شماره موبایل یا رمز عبور اشتباه است" }, { status: 401 });
  }
  if (!checkRateLimit(`login:phone:${phone}`, 5, 15 * 60_000) || !checkRateLimit(`login:ip:${getClientIp(req)}`, 30, 15 * 60_000)) {
    return NextResponse.json({ error: "تعداد تلاش برای ورود بیش از حد مجاز است. کمی بعد تلاش کنید" }, { status: 429 });
  }

  const user = await db
    .selectFrom("users")
    .select(["id", "name", "phone", "password_hash", "status"])
    .where("phone", "=", phone)
    .executeTakeFirst();

  if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "شماره موبایل یا رمز عبور اشتباه است" }, { status: 401 });
  }

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

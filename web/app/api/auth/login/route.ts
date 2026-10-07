import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signSessionToken } from "@/lib/auth";
import { COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

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

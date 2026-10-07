import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isNonEmptyString } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/auth";

// GET /api/account/profile — پروفایل کاربر جاری (بخش «Basic Profile» فاز ۵)
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const user = await db
    .selectFrom("users")
    .select(["id", "name", "phone", "created_at"])
    .where("id", "=", auth.user.id)
    .executeTakeFirstOrThrow();

  return NextResponse.json({ user });
}

// PATCH /api/account/profile — ویرایش نام و/یا تغییر رمز عبور؛ شماره تلفن (شناسهٔ ورود) قابل تغییر نیست
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`account-profile:${getClientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const updates: { name?: string; password_hash?: string } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!isNonEmptyString(name, 120)) return NextResponse.json({ error: "name نامعتبر است" }, { status: 400 });
    updates.name = name;
  }

  if (body.newPassword !== undefined) {
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword) return NextResponse.json({ error: "currentPassword الزامی است" }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد" }, { status: 400 });

    const userRow = await db.selectFrom("users").select(["password_hash"]).where("id", "=", auth.user.id).executeTakeFirstOrThrow();
    const ok = await verifyPassword(currentPassword, userRow.password_hash);
    if (!ok) return NextResponse.json({ error: "رمز عبور فعلی نادرست است" }, { status: 400 });

    updates.password_hash = await hashPassword(newPassword);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده است" }, { status: 400 });
  }

  const user = await db
    .updateTable("users")
    .set(updates)
    .where("id", "=", auth.user.id)
    .returning(["id", "name", "phone", "created_at"])
    .executeTakeFirstOrThrow();

  return NextResponse.json({ user });
}

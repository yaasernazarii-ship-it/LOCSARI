import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isValidIranianPhone } from "@/lib/auth";
import { isNonEmptyString } from "@/lib/validation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/contact — ثبت پیام از فرم عمومی «تماس با ما» (بدون نیاز به ورود)
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`contact-create:ip:${getClientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!isNonEmptyString(name, 150)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
  if (!isValidIranianPhone(phone)) return NextResponse.json({ error: "شمارهٔ موبایل نامعتبر است" }, { status: 400 });
  if (email && !EMAIL_REGEX.test(email)) return NextResponse.json({ error: "ایمیل نامعتبر است" }, { status: 400 });
  if (!isNonEmptyString(message, 2000)) return NextResponse.json({ error: "متن پیام نامعتبر است" }, { status: 400 });

  const saved = await db
    .insertInto("contact_messages")
    .values({
      name,
      phone,
      email: email || null,
      subject: subject ? subject.slice(0, 200) : null,
      message,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return NextResponse.json({ id: saved.id }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { userHasPermission } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseId, isNonEmptyString } from "@/lib/validation";

// GET /api/chats/:id/messages — تاریخچهٔ پیام‌های یک Thread (فقط دو طرف گفتگو، یا ادمین با مجوز نظارتی chat.view).
// برای دو طرف گفتگو، لحظهٔ فراخوانی به‌عنوان last_read ثبت می‌شود (برای نشان‌دادن پیام‌های خوانده‌نشده).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const thread = await db
    .selectFrom("chat_threads")
    .select(["id", "buyer_user_id", "seller_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!thread) return NextResponse.json({ error: "گفتگو یافت نشد" }, { status: 404 });

  const isBuyer = thread.buyer_user_id === auth.user.id;
  const isSeller = thread.seller_user_id === auth.user.id;
  if (!isBuyer && !isSeller) {
    const canModerate = await userHasPermission(auth.user.id, "chat.view");
    if (!canModerate) return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  } else {
    await db
      .updateTable("chat_threads")
      .set(isBuyer ? { buyer_last_read_at: new Date().toISOString() } : { seller_last_read_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
  }

  const messages = await db
    .selectFrom("chat_messages")
    .select(["id", "sender_user_id", "body", "created_at"])
    .where("thread_id", "=", id)
    .orderBy("created_at", "asc")
    .execute();

  return NextResponse.json({ messages });
}

// POST /api/chats/:id/messages — ارسال پیام جدید؛ فقط توسط دو طرف گفتگو (خریدار/آگهی‌دهنده)، ادمین حق ارسال ندارد.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  if (!checkRateLimit(`chat-message:user:${auth.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "تعداد پیام بیش از حد مجاز است؛ کمی صبر کنید" }, { status: 429 });
  }
  if (!checkRateLimit(`chat-message:ip:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "تعداد پیام بیش از حد مجاز است؛ کمی صبر کنید" }, { status: 429 });
  }

  const thread = await db
    .selectFrom("chat_threads")
    .select(["id", "buyer_user_id", "seller_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!thread) return NextResponse.json({ error: "گفتگو یافت نشد" }, { status: 404 });

  const isBuyer = thread.buyer_user_id === auth.user.id;
  const isSeller = thread.seller_user_id === auth.user.id;
  if (!isBuyer && !isSeller) return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!isNonEmptyString(body?.body, 2000)) {
    return NextResponse.json({ error: "متن پیام نامعتبر است" }, { status: 400 });
  }
  const text = body.body.trim();

  const message = await db
    .insertInto("chat_messages")
    .values({ thread_id: id, sender_user_id: auth.user.id, body: text })
    .returningAll()
    .executeTakeFirstOrThrow();

  await db
    .updateTable("chat_threads")
    .set({
      last_message_at: message.created_at.toISOString(),
      ...(isBuyer ? { buyer_last_read_at: message.created_at.toISOString() } : { seller_last_read_at: message.created_at.toISOString() }),
    })
    .where("id", "=", id)
    .execute();

  return NextResponse.json({ message }, { status: 201 });
}

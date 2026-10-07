import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseId } from "@/lib/validation";

// POST /api/chats — شروع یا بازیابی گفتگوی خصوصی با آگهی‌دهنده روی یک آگهی مشخص.
// هر بازدیدکننده (خریدار) به‌ازای هر آگهی فقط یک Thread دارد (unique advertisement_id+buyer_user_id).
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`chat-start:user:${auth.user.id}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const advertisementId = parseId(String(body?.advertisementId ?? ""));
  if (!advertisementId) return NextResponse.json({ error: "advertisementId نامعتبر است" }, { status: 400 });

  const ad = await db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .select(["advertisements.id", "advertisements.status", "advertisements.expires_at", "advertisements.created_by_user_id", "properties.is_active"])
    .where("advertisements.id", "=", advertisementId)
    .executeTakeFirst();

  if (!ad || ad.status !== "published" || !ad.is_active || (ad.expires_at && new Date(ad.expires_at) < new Date())) {
    return NextResponse.json({ error: "آگهی یافت نشد یا برای گفتگو در دسترس نیست" }, { status: 404 });
  }
  if (ad.created_by_user_id === auth.user.id) {
    return NextResponse.json({ error: "این آگهی متعلق به خود شماست" }, { status: 400 });
  }

  const existing = await db
    .selectFrom("chat_threads")
    .select(["id"])
    .where("advertisement_id", "=", advertisementId)
    .where("buyer_user_id", "=", auth.user.id)
    .executeTakeFirst();

  const thread =
    existing ??
    (await db
      .insertInto("chat_threads")
      .values({
        advertisement_id: advertisementId,
        buyer_user_id: auth.user.id,
        seller_user_id: ad.created_by_user_id,
      })
      .onConflict((oc) =>
        oc.columns(["advertisement_id", "buyer_user_id"]).doUpdateSet({ advertisement_id: advertisementId })
      )
      .returning(["id"])
      .executeTakeFirstOrThrow());

  return NextResponse.json({ threadId: thread.id });
}

// GET /api/chats — فهرست گفتگوهای من (چه به‌عنوان خریدار، چه به‌عنوان آگهی‌دهنده) برای /account/messages
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const rows = await db
    .selectFrom("chat_threads")
    .innerJoin("advertisements", "advertisements.id", "chat_threads.advertisement_id")
    .leftJoin("users as buyer", "buyer.id", "chat_threads.buyer_user_id")
    .leftJoin("users as seller", "seller.id", "chat_threads.seller_user_id")
    .select([
      "chat_threads.id",
      "chat_threads.buyer_user_id",
      "chat_threads.seller_user_id",
      "chat_threads.last_message_at",
      "chat_threads.buyer_last_read_at",
      "chat_threads.seller_last_read_at",
      "chat_threads.created_at",
      "advertisements.title as advertisement_title",
      "advertisements.slug as advertisement_slug",
      "buyer.name as buyer_name",
      "seller.name as seller_name",
    ])
    .where((eb) => eb.or([eb("chat_threads.buyer_user_id", "=", auth.user.id), eb("chat_threads.seller_user_id", "=", auth.user.id)]))
    .orderBy((eb) => eb.fn.coalesce("chat_threads.last_message_at", "chat_threads.created_at"), "desc")
    .execute();

  return NextResponse.json({ threads: rows });
}

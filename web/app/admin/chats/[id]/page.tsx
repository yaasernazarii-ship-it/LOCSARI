import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";

// نمایش فقط‌خواندنی متن کامل یک گفتگوی خصوصی برای نظارت مدیریتی (chat.view) — بدون امکان ارسال پیام از طرف ادمین
export default async function AdminChatThreadPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "chat.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ گفتگوهای خصوصی آگهی‌ها را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const thread = await db
    .selectFrom("chat_threads")
    .innerJoin("advertisements", "advertisements.id", "chat_threads.advertisement_id")
    .leftJoin("users as buyer", "buyer.id", "chat_threads.buyer_user_id")
    .leftJoin("users as seller", "seller.id", "chat_threads.seller_user_id")
    .select([
      "chat_threads.id",
      "chat_threads.buyer_user_id",
      "chat_threads.seller_user_id",
      "advertisements.title as advertisement_title",
      "advertisements.slug as advertisement_slug",
      "buyer.name as buyer_name",
      "buyer.phone as buyer_phone",
      "seller.name as seller_name",
      "seller.phone as seller_phone",
    ])
    .where("chat_threads.id", "=", id)
    .executeTakeFirst();

  if (!thread) notFound();

  const messages = await db
    .selectFrom("chat_messages")
    .selectAll()
    .where("thread_id", "=", id)
    .orderBy("created_at", "asc")
    .execute();

  return (
    <>
      <div className="admin-page-header">
        <h1>گفتگو دربارهٔ «{thread.advertisement_title}»</h1>
        <p>
          <Link href="/admin/chats">بازگشت به فهرست گفتگوها</Link>
          {" · "}
          <Link href={`/agahi/${thread.advertisement_slug}`}>مشاهدهٔ آگهی</Link>
        </p>
      </div>

      <div className="form-section">
        <p>
          خریدار: {thread.buyer_name || "—"}{" "}
          {thread.buyer_phone && (
            <span dir="ltr" style={{ color: "#888" }}>
              ({thread.buyer_phone})
            </span>
          )}
        </p>
        <p>
          آگهی‌دهنده: {thread.seller_name || "—"}{" "}
          {thread.seller_phone && (
            <span dir="ltr" style={{ color: "#888" }}>
              ({thread.seller_phone})
            </span>
          )}
        </p>
      </div>

      <div className="form-section">
        <h2>پیام‌ها ({messages.length.toLocaleString("fa-IR")})</h2>
        <div className="chat-box">
          <div className="chat-box__panel">
            <div className="chat-box__messages">
              {messages.length === 0 && <p className="chat-box__empty">هنوز پیامی رد و بدل نشده.</p>}
              {messages.map((m) => {
                const isBuyer = m.sender_user_id === thread.buyer_user_id;
                return (
                  <div key={m.id} className={`chat-bubble ${isBuyer ? "chat-bubble--mine" : "chat-bubble--theirs"}`}>
                    <p>{m.body}</p>
                    <span className="chat-bubble__time">
                      {isBuyer ? "خریدار" : "آگهی‌دهنده"} · {new Date(m.created_at).toLocaleString("fa-IR")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

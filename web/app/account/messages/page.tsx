import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

// صندوق گفتگوهای خصوصی من (فاز ۸) — هم گفتگوهایی که به‌عنوان خریدار شروع کرده‌ام، هم گفتگوهایی
// که روی آگهی‌های خودم دریافت کرده‌ام، در یک فهرست با نشان پیام خوانده‌نشده.
export default async function MessagesInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/messages");

  const rows = await db
    .selectFrom("chat_threads")
    .innerJoin("advertisements", "advertisements.id", "chat_threads.advertisement_id")
    .leftJoin("properties", "properties.id", "advertisements.property_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .leftJoin("users as buyer", "buyer.id", "chat_threads.buyer_user_id")
    .leftJoin("users as seller", "seller.id", "chat_threads.seller_user_id")
    .select((eb) => [
      "chat_threads.id",
      "chat_threads.buyer_user_id",
      "chat_threads.seller_user_id",
      "chat_threads.last_message_at",
      "chat_threads.buyer_last_read_at",
      "chat_threads.seller_last_read_at",
      "chat_threads.created_at",
      "advertisements.title as advertisement_title",
      "advertisements.slug as advertisement_slug",
      "property_media.url as primary_image",
      "buyer.name as buyer_name",
      "seller.name as seller_name",
      eb
        .selectFrom("chat_messages")
        .select((eb2) => eb2.fn.countAll<number>().as("count"))
        .whereRef("chat_messages.thread_id", "=", "chat_threads.id")
        .as("message_count"),
    ])
    .where((eb) => eb.or([eb("chat_threads.buyer_user_id", "=", user.id), eb("chat_threads.seller_user_id", "=", user.id)]))
    .orderBy((eb) => eb.fn.coalesce("chat_threads.last_message_at", "chat_threads.created_at"), "desc")
    .execute();

  return (
    <>
      <div className="account-page-header">
        <h1>گفتگوهای من</h1>
        <p>گفتگوهای خصوصی با آگهی‌دهنده‌ها یا بازدیدکنندگان آگهی‌های شما.</p>
      </div>
      <div className="account-form">
        {rows.length === 0 ? (
          <p className="search-empty">هنوز گفتگویی شروع نشده است.</p>
        ) : (
          <div className="my-ads-list">
            {rows.map((r) => {
              const isBuyer = r.buyer_user_id === user.id;
              const otherName = isBuyer ? r.seller_name : r.buyer_name;
              const lastRead = isBuyer ? r.buyer_last_read_at : r.seller_last_read_at;
              const hasUnread = Number(r.message_count) > 0 && (!lastRead || (r.last_message_at && new Date(r.last_message_at) > new Date(lastRead)));
              return (
                <div key={r.id} className="my-ad-row">
                  <div className="my-ad-row__image">
                    {r.primary_image ? (
                      <img src={r.primary_image} alt={r.advertisement_title} />
                    ) : (
                      <div className="result-card__placeholder" />
                    )}
                  </div>
                  <div className="my-ad-row__body">
                    <div className="my-ad-row__title-line">
                      <h3>
                        <Link href={`/account/messages/${r.id}`}>{r.advertisement_title}</Link>
                      </h3>
                      {hasUnread && <span className="status-badge status-badge--new">پیام جدید</span>}
                    </div>
                    <p className="my-ad-row__meta">
                      {isBuyer ? "آگهی‌دهنده" : "بازدیدکننده"}: {otherName || "—"}
                      {r.last_message_at ? ` · آخرین پیام: ${new Date(r.last_message_at).toLocaleString("fa-IR")}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

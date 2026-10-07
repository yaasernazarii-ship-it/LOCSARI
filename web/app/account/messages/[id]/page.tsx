import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import ChatThreadPanel from "@/components/ChatThreadPanel";

// جزئیات یک گفتگوی خصوصی — فقط برای دو طرف گفتگو قابل مشاهده (IDOR-safe: 404 برای بقیه).
export default async function ChatThreadPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/messages/${encodeURIComponent(params.id)}`);

  const id = parseId(params.id);
  if (!id) notFound();

  const row = await db
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
      "seller.name as seller_name",
    ])
    .where("chat_threads.id", "=", id)
    .executeTakeFirst();

  if (!row || (row.buyer_user_id !== user.id && row.seller_user_id !== user.id)) notFound();

  const isBuyer = row.buyer_user_id === user.id;
  const otherName = isBuyer ? row.seller_name : row.buyer_name;

  return (
    <>
      <div className="account-page-header">
        <h1>گفتگو با {otherName || "کاربر"}</h1>
        <p>
          <Link href="/account/messages">بازگشت به گفتگوهای من</Link>
        </p>
      </div>
      <div className="account-form">
        <div className="form-section">
          <h2>
            <Link href={`/agahi/${row.advertisement_slug}`}>{row.advertisement_title}</Link>
          </h2>
          <div className="chat-box">
            <ChatThreadPanel threadId={row.id} currentUserId={user.id} />
          </div>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminPagination from "@/components/AdminPagination";

const PAGE_SIZE = 20;

// فهرست همهٔ گفتگوهای خصوصی خریدار/آگهی‌دهنده — فقط‌خواندنی، برای نظارت مدیریتی (chat.view)
export default async function AdminChatsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
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

  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  function buildQuery() {
    let query = db
      .selectFrom("chat_threads")
      .innerJoin("advertisements", "advertisements.id", "chat_threads.advertisement_id")
      .leftJoin("users as buyer", "buyer.id", "chat_threads.buyer_user_id")
      .leftJoin("users as seller", "seller.id", "chat_threads.seller_user_id");
    if (q) {
      query = query.where((eb) =>
        eb.or([
          eb("advertisements.title", "ilike", `%${q}%`),
          eb("buyer.name", "ilike", `%${q}%`),
          eb("buyer.phone", "ilike", `%${q}%`),
          eb("seller.name", "ilike", `%${q}%`),
          eb("seller.phone", "ilike", `%${q}%`),
        ]),
      );
    }
    return query;
  }

  const [{ count } = { count: 0 }, threads] = await Promise.all([
    buildQuery()
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst() as Promise<{ count: number }>,
    buildQuery()
      .select([
        "chat_threads.id",
        "chat_threads.last_message_at",
        "chat_threads.created_at",
        "advertisements.title as advertisement_title",
        "advertisements.slug as advertisement_slug",
        "buyer.name as buyer_name",
        "buyer.phone as buyer_phone",
        "seller.name as seller_name",
        "seller.phone as seller_phone",
      ])
      .orderBy((eb) => eb.fn.coalesce("chat_threads.last_message_at", "chat_threads.created_at"), "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  return (
    <>
      <div className="admin-page-header">
        <h1>گفتگوهای آگهی‌ها</h1>
        <p>{Number(count).toLocaleString("fa-IR")} گفتگوی خصوصی خریدار/آگهی‌دهنده (فهرست فقط‌خواندنی)</p>
      </div>

      <form method="get" className="admin-filters">
        <input type="text" name="q" placeholder="جستجوی عنوان آگهی، نام یا موبایل طرفین" defaultValue={q ?? ""} />
        <button className="btn-primary" type="submit">
          اعمال فیلتر
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>آگهی</th>
              <th>خریدار</th>
              <th>آگهی‌دهنده</th>
              <th>آخرین پیام</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/agahi/${t.advertisement_slug}`}>{t.advertisement_title}</Link>
                </td>
                <td>
                  {t.buyer_name || "—"}
                  {t.buyer_phone && (
                    <>
                      {" "}
                      <span dir="ltr" style={{ color: "#888" }}>
                        ({t.buyer_phone})
                      </span>
                    </>
                  )}
                </td>
                <td>
                  {t.seller_name || "—"}
                  {t.seller_phone && (
                    <>
                      {" "}
                      <span dir="ltr" style={{ color: "#888" }}>
                        ({t.seller_phone})
                      </span>
                    </>
                  )}
                </td>
                <td>{new Date(t.last_message_at ?? t.created_at).toLocaleString("fa-IR")}</td>
                <td>
                  <Link href={`/admin/chats/${t.id}`}>مشاهده</Link>
                </td>
              </tr>
            ))}
            {threads.length === 0 && (
              <tr>
                <td colSpan={5} className="search-empty">
                  گفتگویی یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination basePath="/admin/chats" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}

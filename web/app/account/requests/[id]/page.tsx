import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from "@/lib/labels";
import RequestStatusSelect from "@/components/RequestStatusSelect";

// جزئیات کامل یک درخواست تماس/بازدید — فقط برای مالک آگهی یا خودِ درخواست‌دهنده قابل مشاهده (IDOR-safe: 404 برای بقیه).
export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/requests/${encodeURIComponent(params.id)}`);

  const id = parseId(params.id);
  if (!id) notFound();

  const row = await db
    .selectFrom("advertisement_inquiries")
    .innerJoin("advertisements", "advertisements.id", "advertisement_inquiries.advertisement_id")
    .select([
      "advertisement_inquiries.id",
      "advertisement_inquiries.owner_user_id",
      "advertisement_inquiries.user_id",
      "advertisement_inquiries.type",
      "advertisement_inquiries.name",
      "advertisement_inquiries.phone",
      "advertisement_inquiries.message",
      "advertisement_inquiries.preferred_date",
      "advertisement_inquiries.preferred_time",
      "advertisement_inquiries.status",
      "advertisement_inquiries.created_at",
      "advertisements.title as advertisement_title",
      "advertisements.slug as advertisement_slug",
    ])
    .where("advertisement_inquiries.id", "=", id)
    .executeTakeFirst();

  if (!row || (row.owner_user_id !== user.id && row.user_id !== user.id)) notFound();

  const received = row.owner_user_id === user.id;

  return (
    <>
      <div className="account-page-header">
        <h1>جزئیات درخواست</h1>
        <p>
          <Link href="/account/requests">بازگشت به درخواست‌های من</Link>
        </p>
      </div>
      <div className="account-form">
        <div className="form-section">
          <h2>
            <Link href={`/agahi/${row.advertisement_slug}`}>{row.advertisement_title}</Link>
          </h2>
          <p className="my-ad-row__meta">
            نوع: {REQUEST_TYPE_LABELS[row.type] ?? row.type} · وضعیت:{" "}
            <span className={`status-badge status-badge--${row.status}`}>{REQUEST_STATUS_LABELS[row.status] ?? row.status}</span>
          </p>
          {received && (
            <p className="my-ad-row__meta">
              نام: {row.name} · تلفن: <a href={`tel:${row.phone}`}>{row.phone}</a>
            </p>
          )}
          {row.preferred_date && (
            <p className="my-ad-row__meta">
              تاریخ پیشنهادی: {new Date(row.preferred_date).toLocaleDateString("fa-IR")}
              {row.preferred_time ? ` ساعت ${row.preferred_time}` : ""}
            </p>
          )}
          {row.message && <p className="detail-description">{row.message}</p>}
          <p className="my-ad-row__meta">ثبت‌شده در: {new Date(row.created_at).toLocaleDateString("fa-IR")}</p>

          {received && (
            <div className="form-group">
              <label>تغییر وضعیت</label>
              <RequestStatusSelect requestId={row.id} status={row.status} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

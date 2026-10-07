import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from "@/lib/labels";
import RequestStatusSelect from "@/components/RequestStatusSelect";

// صندوق واحد درخواست‌های تماس/بازدید (فاز ۵.۱) — هم درخواست‌های دریافتی (روی آگهی‌های خودم)
// و هم درخواست‌های ارسالی (که خودم برای آگهی دیگران ثبت کرده‌ام)، در یک صفحه.
export default async function RequestsInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/requests");

  const rows = await db
    .selectFrom("advertisement_inquiries")
    .innerJoin("advertisements", "advertisements.id", "advertisement_inquiries.advertisement_id")
    .leftJoin("properties", "properties.id", "advertisements.property_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .select([
      "advertisement_inquiries.id",
      "advertisement_inquiries.owner_user_id",
      "advertisement_inquiries.type",
      "advertisement_inquiries.name",
      "advertisement_inquiries.preferred_date",
      "advertisement_inquiries.preferred_time",
      "advertisement_inquiries.status",
      "advertisement_inquiries.created_at",
      "advertisements.title as advertisement_title",
      "property_media.url as primary_image",
    ])
    .where((eb) =>
      eb.or([eb("advertisement_inquiries.owner_user_id", "=", user.id), eb("advertisement_inquiries.user_id", "=", user.id)])
    )
    .orderBy("advertisement_inquiries.created_at", "desc")
    .execute();

  return (
    <>
      <div className="account-page-header">
        <h1>درخواست‌های من</h1>
        <p>درخواست‌های تماس/بازدیدی که دریافت کرده‌اید یا خودتان ثبت کرده‌اید.</p>
      </div>
      <div className="account-form">
        {rows.length === 0 ? (
          <p className="search-empty">هنوز درخواستی ثبت نشده است.</p>
        ) : (
          <div className="my-ads-list">
            {rows.map((r) => {
              const received = r.owner_user_id === user.id;
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
                        <Link href={`/account/requests/${r.id}`}>{r.advertisement_title}</Link>
                      </h3>
                      <span className="status-badge">{received ? "دریافت‌شده" : "ارسال‌شده"}</span>
                      <span className={`status-badge status-badge--${r.status}`}>
                        {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="my-ad-row__meta">
                      {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                      {received ? ` · درخواست‌دهنده: ${r.name}` : ""}
                      {r.preferred_date ? ` · تاریخ پیشنهادی: ${new Date(r.preferred_date).toLocaleDateString("fa-IR")}` : ""}
                      {r.preferred_time ? ` ساعت ${r.preferred_time}` : ""}
                    </p>
                    {received && <RequestStatusSelect requestId={r.id} status={r.status} />}
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

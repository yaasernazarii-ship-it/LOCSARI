import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { syncExpiredStatus } from "@/lib/advertisementWorkflow";
import { ADVERTISEMENT_STATUS_LABELS, formatPriceLine } from "@/lib/labels";
import MyAdvertisementActions from "@/components/MyAdvertisementActions";

// صفحهٔ «آگهی‌های من» — لیست همهٔ آگهی‌های کاربر جاری با هر وضعیتی + دکمه‌های عملیات.
export default async function MyAdvertisementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/advertisements");

  const rows = await db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("categories", "categories.id", "properties.category_id")
    .leftJoin("property_media", (join) =>
      join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
    )
    .selectAll("advertisements")
    .select(["categories.name as category_name", "property_media.url as primary_image"])
    .where("advertisements.created_by_user_id", "=", user.id)
    .orderBy("advertisements.created_at", "desc")
    .execute();

  const ads = await Promise.all(
    rows.map(async (row) => {
      await syncExpiredStatus(db, row);
      const status =
        row.status === "published" && row.expires_at && new Date(row.expires_at) < new Date() ? "expired" : row.status;
      return { ...row, status };
    })
  );

  return (
    <>
      <div className="account-page-header">
        <h1>آگهی‌های من</h1>
        <p>
          <Link href="/account/advertisements/new">+ ثبت آگهی جدید</Link>
        </p>
      </div>
      <div className="account-form">
        {ads.length === 0 ? (
          <p className="search-empty">هنوز آگهی‌ای ثبت نکرده‌اید.</p>
        ) : (
          <div className="my-ads-list">
            {ads.map((ad) => (
              <div key={ad.id} className="my-ad-row">
                <div className="my-ad-row__image">
                  {ad.primary_image ? <img src={ad.primary_image} alt={ad.title} /> : <div className="result-card__placeholder" />}
                </div>
                <div className="my-ad-row__body">
                  <div className="my-ad-row__title-line">
                    <h3>{ad.title}</h3>
                    <span className={`status-badge status-badge--${ad.status}`}>
                      {ADVERTISEMENT_STATUS_LABELS[ad.status] ?? ad.status}
                    </span>
                  </div>
                  <p className="my-ad-row__meta">
                    {ad.category_name} · {formatPriceLine({
                      transactionType: ad.transaction_type,
                      price: ad.price !== null ? Number(ad.price) : null,
                      deposit: ad.deposit !== null ? Number(ad.deposit) : null,
                      monthlyRent: ad.monthly_rent !== null ? Number(ad.monthly_rent) : null,
                    })}
                  </p>
                  <p className="my-ad-row__meta">
                    تاریخ انتشار: {ad.published_at ? new Date(ad.published_at).toLocaleDateString("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }) : "هنوز منتشر نشده"}
                  </p>
                  <MyAdvertisementActions advertisementId={ad.id} status={ad.status} slug={ad.slug} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

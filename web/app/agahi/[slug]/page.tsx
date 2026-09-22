import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdvertisementDetail, AdvertisementDetail } from "@/lib/search/detail";
import { getSimilarAdvertisements } from "@/lib/search/similar";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { TRANSACTION_TYPE_LABELS, formatPriceLine, formatPublicationDate } from "@/lib/labels";
import { toAparatEmbedUrl } from "@/lib/aparat";
import { BadgeCheck } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import AdCard from "@/components/AdCard";
import ContactBox from "@/components/ContactBox";
import ChatBox from "@/components/ChatBox";
import AdvertisementGallery from "@/components/AdvertisementGallery";

// صفحهٔ عمومی جزئیات آگهی (بخش ۲۶ پرامپت فاز ۴) — کاملاً سمت سرور، بدون fetch داخلی از API خودمان
// (مستقیماً از lib/search/detail.ts که هم‌زمان API را هم تغذیه می‌کند).

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ad = await getAdvertisementDetail(params.slug);
  if (!ad) return { title: "آگهی یافت نشد | لوکیشن ساری" };
  return {
    title: `${ad.title} | لوکیشن ساری`,
    description: (ad.description ?? ad.title).slice(0, 150),
  };
}

async function loadFavoriteState(userId: number | null, advertisementIds: number[]): Promise<Set<number>> {
  if (!userId || advertisementIds.length === 0) return new Set();
  const rows = await db
    .selectFrom("favorites")
    .select("advertisement_id")
    .where("user_id", "=", userId)
    .where("advertisement_id", "in", advertisementIds)
    .execute();
  return new Set(rows.map((r) => r.advertisement_id));
}

const propertyFactLabels: { key: keyof AdvertisementDetail["property"]; label: string; unit?: string }[] = [
  { key: "area", label: "متراژ", unit: "متر مربع" },
  { key: "builtArea", label: "زیربنا", unit: "متر مربع" },
  { key: "landArea", label: "متراژ زمین", unit: "متر مربع" },
  { key: "bedrooms", label: "تعداد اتاق" },
  { key: "builtYear", label: "سال ساخت" },
  { key: "floor", label: "طبقه" },
  { key: "totalFloors", label: "تعداد طبقات" },
  { key: "totalUnits", label: "تعداد واحد" },
];

export default async function AdvertisementDetailPage({ params }: Props) {
  const ad = await getAdvertisementDetail(params.slug);
  if (!ad) notFound();

  const [user, similar, ownerRow, cipRow] = await Promise.all([
    getCurrentUser(),
    getSimilarAdvertisements({
      excludeAdId: ad.id,
      categoryId: ad.category.id,
      cityId: ad.cityId,
      transactionType: ad.transactionType,
      price: ad.price,
    }),
    db.selectFrom("advertisements").select("created_by_user_id").where("id", "=", ad.id).executeTakeFirst(),
    db.selectFrom("cip_requests").select("video_url").where("advertisement_id", "=", ad.id).where("status", "=", "published").where("video_url", "is not", null).orderBy("updated_at", "desc").executeTakeFirst(),
  ]);
  const favoriteIds = await loadFavoriteState(
    user?.id ?? null,
    [ad.id, ...similar.map((s) => s.id)]
  );
  const userId = user?.id ?? null;
  const favorited = favoriteIds.has(ad.id);
  const isOwner = !!userId && ownerRow?.created_by_user_id === userId;

  const vipEmbedUrl = ad.vip.isVip && ad.vip.videoUrl ? toAparatEmbedUrl(ad.vip.videoUrl) : null;
  const cipEmbedUrl = cipRow?.video_url ? toAparatEmbedUrl(cipRow.video_url) : null;

  return (
    <div className="detail-page">
      <div className="detail-breadcrumb">
        <Link href="/amlak">جستجوی املاک</Link> ‹ <span>{ad.category.name}</span>
      </div>

      <div className="detail-header">
        <h1>
          {ad.title}
          {ad.vip.isVip && <BadgeCheck size={20} className="vip-check" aria-label="آگهی VIP" />}
        </h1>
        <span className="badge" dir="ltr">شناسه: {ad.publicCode}</span>
        <FavoriteButton advertisementId={ad.id} initialFavorited={favorited} isLoggedIn={!!userId} />
      </div>

      <div className="detail-meta">
        <span className="badge">{TRANSACTION_TYPE_LABELS[ad.transactionType as keyof typeof TRANSACTION_TYPE_LABELS] ?? ad.transactionType}</span>
        {ad.vip.isVip && <span className="badge">VIP</span>}
        <span className="detail-price">{formatPriceLine(ad)}</span>
      </div>

      <p className="detail-location">
        {ad.location.neighborhood || "ساری"}
      </p>

      {ad.media.length > 0 && <AdvertisementGallery media={ad.media} title={ad.title} />}

      {vipEmbedUrl && (
        <section className="detail-section">
          <h2>ویدیوی آگهی</h2>
          <div className="static-page__video" style={{ maxWidth: 860 }}>
            <iframe src={vipEmbedUrl} allowFullScreen title={`ویدیوی آگهی ${ad.title}`} />
          </div>
        </section>
      )}

      {cipEmbedUrl && (
        <section className="detail-section">
          <h2>ویدیوی اختصاصی CIP</h2>
          <div className="static-page__video" style={{ maxWidth: 860 }}>
            <iframe src={cipEmbedUrl} allowFullScreen title={`ویدیوی CIP ${ad.title}`} />
          </div>
        </section>
      )}

      <section className="detail-section">
        <h2>مشخصات ملک</h2>
        <div className="detail-facts">
          {propertyFactLabels.map(({ key, label, unit }) => {
            const value = ad.property[key];
            if (value === null || value === undefined) return null;
            return (
              <div key={key} className="detail-fact">
                <span className="detail-fact__label">{label}</span>
                <span className="detail-fact__value">
                  {(key === "builtYear" ? Math.trunc(value) : value).toLocaleString("fa-IR")} {unit ?? ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {ad.attributes.length > 0 && (
        <section className="detail-section">
          <h2>ویژگی‌های اضافی</h2>
          <div className="detail-facts">
            {ad.attributes.map((a) => (
              <div key={a.key} className="detail-fact">
                <span className="detail-fact__label">{a.label}</span>
                <span className="detail-fact__value">
                  {a.type === "boolean" ? (a.value ? "دارد" : "ندارد") : String(a.value ?? "-")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ad.description && (
        <section className="detail-section">
          <h2>توضیحات</h2>
          <p className="detail-description">{ad.description}</p>
        </section>
      )}

      {ad.location.lat !== null && ad.location.lng !== null && (
        <section className="detail-section">
          <h2>موقعیت روی نقشه</h2>
          <p className="detail-map-note">
            مختصات تقریبی: {ad.location.lat.toFixed(4)}، {ad.location.lng.toFixed(4)}
          </p>
        </section>
      )}

      {ad.publishedAt && (
        <p className="detail-published-at">تاریخ انتشار: {formatPublicationDate(ad.publishedAt)}</p>
      )}

      {(ad.publisher.consultant || ad.publisher.agency) && (
        <section className="detail-section detail-publisher">
          <h2>آگهی‌دهنده</h2>
          {ad.publisher.consultant && (
            <div className="detail-publisher__card">
              {ad.publisher.consultant.avatar && <img src={ad.publisher.consultant.avatar} alt={ad.publisher.consultant.name} />}
              <div>
                <span className="badge">مشاور املاک</span>
                <p className="detail-publisher__name">{ad.publisher.consultant.name}</p>
                {ad.publisher.agency && <p className="detail-publisher__agency">{ad.publisher.agency.name}</p>}
                <Link href={`/moshaver/${ad.publisher.consultant.slug}`}>مشاهده پروفایل</Link>
              </div>
            </div>
          )}
          {!ad.publisher.consultant && ad.publisher.agency && (
            <div className="detail-publisher__card">
              {ad.publisher.agency.logo && <img src={ad.publisher.agency.logo} alt={ad.publisher.agency.name} />}
              <div>
                <span className="badge">آژانس املاک</span>
                <p className="detail-publisher__name">{ad.publisher.agency.name}</p>
                <Link href={`/agency/${ad.publisher.agency.slug}`}>مشاهده آژانس</Link>
              </div>
            </div>
          )}
        </section>
      )}

      <ContactBox advertisementId={ad.id} slug={ad.slug} isLoggedIn={!!userId} />

      {!isOwner && (
        <ChatBox advertisementId={ad.id} slug={ad.slug} isLoggedIn={!!userId} currentUserId={userId} />
      )}

      {similar.length > 0 && (
        <section className="detail-section">
          <h2>آگهی‌های مشابه</h2>
          <div className="result-grid">
            {similar.map((item) => (
              <AdCard key={item.id} item={item} isLoggedIn={!!userId} favorited={favoriteIds.has(item.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

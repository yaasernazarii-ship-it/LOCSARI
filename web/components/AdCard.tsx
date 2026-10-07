import Link from "next/link";
import { MapPin, Ruler, BedDouble, BadgeCheck } from "lucide-react";
import { TRANSACTION_TYPE_LABELS, formatPriceLine, formatPublicationDate } from "@/lib/labels";
import { TransactionType } from "@/lib/validation";
import FavoriteButton from "@/components/FavoriteButton";

// کارت نمایش آگهی — مشترک بین جستجو (/amlak)، آگهی‌های مشابه، علاقه‌مندی‌ها و صفحهٔ اصلی
// تا markup کارت در چند صفحه تکرار نشود (فاز ۵).

export interface AdCardItem {
  id: number;
  slug: string;
  title: string;
  transactionType: string;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  area: number | null;
  bedrooms: number | null;
  primaryImage: string | null;
  publishedAt: string | null;
  location: { district: string | null; marketZone: string | null; neighborhood: string | null };
  publisher?: { consultantName: string | null; consultantSlug: string | null; agencyName: string | null; agencySlug: string | null };
  isVip?: boolean;
}

export default function AdCard({
  item,
  isLoggedIn,
  favorited,
}: {
  item: AdCardItem;
  isLoggedIn: boolean;
  favorited: boolean;
}) {
  return (
    <Link href={`/agahi/${item.slug}`} className="result-card">
      <div className="result-card__image">
        {item.primaryImage ? <img src={item.primaryImage} alt={item.title} /> : <div className="result-card__placeholder" />}
        {item.isVip && (
          <span className="result-card__vip-badge">
            <BadgeCheck size={14} />
            VIP
          </span>
        )}
        <FavoriteButton advertisementId={item.id} initialFavorited={favorited} isLoggedIn={isLoggedIn} />
      </div>
      <div className="result-card__body">
        <span className="badge">{TRANSACTION_TYPE_LABELS[item.transactionType as TransactionType] ?? item.transactionType}</span>
        {item.publisher?.consultantName && <span className="badge badge--publisher">مشاور املاک</span>}
        {!item.publisher?.consultantName && item.publisher?.agencyName && <span className="badge badge--publisher">آژانس املاک</span>}
        <h3>
          {item.title}
          {item.isVip && <BadgeCheck size={16} className="vip-check" aria-label="آگهی VIP" />}
        </h3>
        <p className="result-card__location">
          <MapPin size={13} />
          {item.location.neighborhood || "ساری"}
        </p>
        <p className="result-card__specs">
          {item.area !== null && (
            <span>
              <Ruler size={14} />
              {item.area.toLocaleString("fa-IR")} متر
            </span>
          )}
          {item.bedrooms !== null && (
            <span>
              <BedDouble size={14} />
              {item.bedrooms.toLocaleString("fa-IR")} خوابه
            </span>
          )}
        </p>
        <p className="result-card__price">{formatPriceLine(item)}</p>
        <p className="result-card__date">تاریخ انتشار: {formatPublicationDate(item.publishedAt)}</p>
      </div>
    </Link>
  );
}

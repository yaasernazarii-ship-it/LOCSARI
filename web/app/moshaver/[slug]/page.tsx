import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicConsultantProfile } from "@/lib/publicProfile";
import { runSearch } from "@/lib/search/query";
import AdCard from "@/components/AdCard";

// صفحهٔ عمومی پروفایل مشاور املاک (فاز ۶، بخش ۱۴) — فقط approved+active؛ در غیر این صورت ۴۰۴.

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const consultant = await getPublicConsultantProfile(params.slug);
  if (!consultant) return { title: "مشاور یافت نشد | لوکیشن ساری" };
  return {
    title: `${consultant.displayName} | مشاور املاک | لوکیشن ساری`,
    description: (consultant.bio ?? `مشاور املاک ${consultant.displayName} در ساری`).slice(0, 150),
    alternates: { canonical: `/moshaver/${consultant.slug}` },
    openGraph: {
      title: consultant.displayName,
      description: consultant.bio ?? undefined,
      images: consultant.avatar ? [consultant.avatar] : undefined,
    },
  };
}

export default async function ConsultantProfilePage({ params }: Props) {
  const consultant = await getPublicConsultantProfile(params.slug);
  if (!consultant) notFound();

  const searchResult = await runSearch({
    q: null,
    categoryId: null,
    subcategoryId: null,
    transactionType: null,
    districtId: null,
    marketZoneId: null,
    neighborhoodId: null,
    minPrice: null,
    maxPrice: null,
    minDeposit: null,
    maxDeposit: null,
    minMonthlyRent: null,
    maxMonthlyRent: null,
    minArea: null,
    maxArea: null,
    bedrooms: null,
    builtYear: null,
    floor: null,
    totalFloors: null,
    agencyId: null,
    consultantId: consultant.id,
    attrs: {},
    bbox: null,
    sort: "newest",
    page: 1,
    limit: 12,
  });
  const ads = searchResult.ok ? searchResult.data.items : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: consultant.displayName,
    description: consultant.bio ?? undefined,
    image: consultant.avatar ?? undefined,
    telephone: consultant.phone ?? undefined,
    memberOf: consultant.agency ? { "@type": "Organization", name: consultant.agency.name } : undefined,
  };

  return (
    <div className="detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="profile-header">
        {consultant.avatar && <img src={consultant.avatar} alt={consultant.displayName} className="profile-header__logo" />}
        <div>
          <h1>{consultant.displayName}</h1>
          {consultant.agency && (
            <p className="detail-location">
              مشاور آژانس{" "}
              <Link href={`/agency/${consultant.agency.slug}`}>{consultant.agency.name}</Link>
            </p>
          )}
        </div>
      </div>

      {consultant.bio && (
        <section className="detail-section">
          <h2>دربارهٔ مشاور</h2>
          <p className="detail-description">{consultant.bio}</p>
        </section>
      )}

      <section className="detail-section">
        <h2>اطلاعات تماس</h2>
        <div className="detail-facts">
          {consultant.phone && (
            <div className="detail-fact">
              <span className="detail-fact__label">موبایل</span>
              <span className="detail-fact__value">{consultant.phone}</span>
            </div>
          )}
          {consultant.licenseNumber && (
            <div className="detail-fact">
              <span className="detail-fact__label">شمارهٔ پروانه</span>
              <span className="detail-fact__value">{consultant.licenseNumber}</span>
            </div>
          )}
        </div>
        {consultant.socialLinks.length > 0 && (
          <p className="detail-social-links">
            {consultant.socialLinks.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                {s.provider ?? s.url}
              </a>
            ))}
          </p>
        )}
      </section>

      <section className="detail-section">
        <h2>آگهی‌های مشاور ({consultant.adCount.toLocaleString("fa-IR")})</h2>
        {ads.length === 0 ? (
          <p className="search-empty">در حال حاضر آگهی منتشرشده‌ای ندارد.</p>
        ) : (
          <div className="result-grid">
            {ads.map((item) => (
              <AdCard key={item.id} item={item} isLoggedIn={false} favorited={false} />
            ))}
          </div>
        )}
        {consultant.adCount > ads.length && (
          <Link href={`/amlak?consultantId=${consultant.id}`} className="btn-secondary">
            مشاهدهٔ همهٔ آگهی‌های این مشاور
          </Link>
        )}
      </section>
    </div>
  );
}

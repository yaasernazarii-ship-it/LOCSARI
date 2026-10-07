import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicAgencyProfile } from "@/lib/publicProfile";
import { runSearch } from "@/lib/search/query";
import { db } from "@/lib/db";
import AdCard from "@/components/AdCard";

// صفحهٔ عمومی پروفایل آژانس (فاز ۶، بخش ۱۳) — فقط برای verification_status=approved و is_active=true؛
// در غیر این صورت ۴۰۴ (که خودبه‌خود از Index موتورهای جستجو هم خارجش می‌کند).

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agency = await getPublicAgencyProfile(params.slug);
  if (!agency) return { title: "آژانس یافت نشد | لوکیشن ساری" };
  return {
    title: `${agency.name} | آژانس املاک | لوکیشن ساری`,
    description: (agency.description ?? `آژانس املاک ${agency.name} در ساری`).slice(0, 150),
    alternates: { canonical: `/agency/${agency.slug}` },
    openGraph: {
      title: agency.name,
      description: agency.description ?? undefined,
      images: agency.logo ? [agency.logo] : undefined,
    },
  };
}

export default async function AgencyProfilePage({ params }: Props) {
  const agency = await getPublicAgencyProfile(params.slug);
  if (!agency) notFound();

  const cityRow = await db.selectFrom("cities").select(["id"]).where("name", "=", agency.cityName).executeTakeFirst();
  const searchResult = cityRow
    ? await runSearch({
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
        agencyId: agency.id,
        consultantId: null,
        attrs: {},
        bbox: null,
        sort: "newest",
        page: 1,
        limit: 12,
      })
    : null;
  const ads = searchResult?.ok ? searchResult.data.items : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: agency.name,
    description: agency.description ?? undefined,
    image: agency.logo ?? undefined,
    telephone: agency.phone ?? agency.mobile ?? undefined,
    email: agency.email ?? undefined,
    url: agency.website ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: agency.cityName,
      streetAddress: agency.address ?? undefined,
    },
  };

  return (
    <div className="detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {agency.coverImage && (
        <div className="profile-cover">
          <img src={agency.coverImage} alt={agency.name} />
        </div>
      )}

      <div className="profile-header">
        {agency.logo && <img src={agency.logo} alt={agency.name} className="profile-header__logo" />}
        <div>
          <h1>{agency.name}</h1>
          <p className="detail-location">
            {[agency.districtName, agency.marketZoneName, agency.neighborhoodName].filter(Boolean).join(" · ") || agency.cityName}
          </p>
        </div>
      </div>

      {agency.description && (
        <section className="detail-section">
          <h2>دربارهٔ آژانس</h2>
          <p className="detail-description">{agency.description}</p>
        </section>
      )}

      <section className="detail-section">
        <h2>اطلاعات تماس</h2>
        <div className="detail-facts">
          {agency.phone && (
            <div className="detail-fact">
              <span className="detail-fact__label">تلفن</span>
              <span className="detail-fact__value">{agency.phone}</span>
            </div>
          )}
          {agency.mobile && (
            <div className="detail-fact">
              <span className="detail-fact__label">موبایل</span>
              <span className="detail-fact__value">{agency.mobile}</span>
            </div>
          )}
          {agency.address && (
            <div className="detail-fact">
              <span className="detail-fact__label">آدرس</span>
              <span className="detail-fact__value">{agency.address}</span>
            </div>
          )}
        </div>
        {agency.socialLinks.length > 0 && (
          <p className="detail-social-links">
            {agency.socialLinks.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                {s.provider ?? s.url}
              </a>
            ))}
          </p>
        )}
      </section>

      {agency.consultants.length > 0 && (
        <section className="detail-section">
          <h2>مشاوران آژانس ({agency.consultants.length.toLocaleString("fa-IR")})</h2>
          <div className="result-grid">
            {agency.consultants.map((c) => (
              <Link key={c.id} href={`/moshaver/${c.slug}`} className="result-card result-card--consultant">
                {c.avatar && <img src={c.avatar} alt={c.displayName} />}
                <h3>{c.displayName}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="detail-section">
        <h2>آگهی‌های آژانس ({agency.adCount.toLocaleString("fa-IR")})</h2>
        {ads.length === 0 ? (
          <p className="search-empty">در حال حاضر آگهی منتشرشده‌ای ندارد.</p>
        ) : (
          <div className="result-grid">
            {ads.map((item) => (
              <AdCard key={item.id} item={item} isLoggedIn={false} favorited={false} />
            ))}
          </div>
        )}
        {agency.adCount > ads.length && (
          <Link href={`/amlak?agencyId=${agency.id}`} className="btn-secondary">
            مشاهدهٔ همهٔ آگهی‌های این آژانس
          </Link>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { Check, Play, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { getSiteContent } from "@/lib/siteContent";
import { formatToman, formatPriceLine } from "@/lib/labels";
import { toAparatEmbedUrl } from "@/lib/aparat";

export const metadata = { title: "آگهی‌های CIP" };

// صفحهٔ عمومی «آگهی‌های CIP» — آگهی‌هایی که برایشان ویدیوی اختصاصی ساخته و منتشر شده + معرفی پلن‌ها.
export default async function CipPage() {
  const [content, plans, videos, settings] = await Promise.all([
    getSiteContent(),
    db.selectFrom("cip_plans").selectAll().where("is_active", "=", true).orderBy("sort_order", "asc").execute(),
    db
      .selectFrom("cip_requests")
      .innerJoin("advertisements", "advertisements.id", "cip_requests.advertisement_id")
      .leftJoin("property_media", (join) =>
        join.onRef("property_media.property_id", "=", "advertisements.property_id").on("property_media.is_primary", "=", true)
      )
      .select([
        "cip_requests.id",
        "cip_requests.video_url",
        "advertisements.slug",
        "advertisements.title",
        "advertisements.transaction_type",
        "advertisements.price",
        "advertisements.deposit",
        "advertisements.monthly_rent",
        "property_media.url as primary_image",
      ])
      .where("cip_requests.status", "=", "published")
      .where("cip_requests.video_url", "is not", null)
      .where("advertisements.status", "=", "published")
      .orderBy("cip_requests.updated_at", "desc")
      .execute(),
    db.selectFrom("cip_page_settings").select("video_url").where("id", "=", 1).executeTakeFirst(),
  ]);
  const introductionVideoUrl = settings?.video_url ? toAparatEmbedUrl(settings.video_url) : null;

  return (
    <>
      <section className="home-hero" style={content["cip.hero.image"] ? { backgroundImage: `url("${content["cip.hero.image"]}")` } : undefined}>
        <div className="home-hero__inner">
          <h1>{content["cip.hero_title"]}</h1>
          <p>{content["cip.hero_description"]}</p>
        </div>
      </section>

      {introductionVideoUrl && (
        <section className="home-section cip-introduction">
          <div className="home-section__heading"><span className="cip-eyebrow">CIP EXPERIENCE</span><h2>معرفی خدمات CIP</h2></div>
          <div className="cip-introduction__video">
            <iframe title="معرفی خدمات CIP" src={introductionVideoUrl} allowFullScreen />
          </div>
        </section>
      )}

      <section className="home-section cip-showcase">
        <div className="home-section__heading cip-showcase__heading">
          <span className="cip-eyebrow">SELECTED PROPERTIES</span>
          <h2>{content["cip.videos_title"]}</h2>
        </div>
        {videos.length === 0 ? (
          <p className="search-empty">{content["cip.empty_message"]}</p>
        ) : (
          <div className="cip-video-grid">
            {videos.map((video) => (
              <Link key={video.id} href={`/agahi/${video.slug}`} className="cip-video-card">
                <div className="cip-video-card__image">
                  {video.primary_image ? <img src={video.primary_image} alt={video.title} /> : <div className="result-card__placeholder" />}
                  <span className="cip-video-card__badge"><Sparkles size={14} /> CIP</span>
                  <span className="cip-video-card__play"><Play size={22} fill="currentColor" /></span>
                </div>
                <div className="cip-video-card__body">
                  <h3>{video.title}</h3>
                  <p className="cip-video-card__price">{formatPriceLine({ transactionType: video.transaction_type, price: video.price !== null ? Number(video.price) : null, deposit: video.deposit !== null ? Number(video.deposit) : null, monthlyRent: video.monthly_rent !== null ? Number(video.monthly_rent) : null })}</p>
                  <span>تماشای ویدیوی اختصاصی</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="home-section cip-plans">
        <div className="home-section__heading cip-showcase__heading">
          <span className="cip-eyebrow">TAILORED PRODUCTION</span>
          <h2>{content["cip.plans_title"]}</h2>
          <p>{content["cip.plans_description"]}</p>
        </div>
        <div className="cip-plan-grid">
          {plans.map((plan) => (
            <article key={plan.id} className="cip-plan-card">
              <div className="cip-plan-card__top"><span>پلن تولید محتوا</span><Sparkles size={19} /></div>
              <h2>{plan.title}</h2>
              {plan.description && <p className="cip-plan-card__description">{plan.description}</p>}
              <p className="cip-plan-card__price">{formatToman(Number(plan.price))}</p>
              <ul>{plan.features.split("\n").filter(Boolean).map((feature) => <li key={feature}><Check size={17} />{feature}</li>)}</ul>
              <Link className="cip-plan-card__action" href={`/account/cip?plan=${plan.id}`}>انتخاب این پلن <span>←</span></Link>
            </article>
          ))}
          {plans.length === 0 && <p className="search-empty">در حال حاضر پلن فعالی برای CIP وجود ندارد.</p>}
        </div>
      </section>
    </>
  );
}

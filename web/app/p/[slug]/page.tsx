import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { toAparatEmbedUrl } from "@/lib/aparat";

type Props = { params: { slug: string }; searchParams?: { preview?: string } };

async function getPage(slug: string, includeDraft = false) {
  let query = db.selectFrom("site_pages").selectAll().where("slug", "=", slug);
  if (!includeDraft) query = query.where("is_published", "=", true);
  return query.executeTakeFirst();
}

async function getPageImages(pageId: number) {
  return db.selectFrom("site_page_images").selectAll().where("page_id", "=", pageId).orderBy("sort_order", "asc").orderBy("id", "asc").execute();
}

function toDescription(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return { title: "صفحه یافت نشد | لوکیشن ساری" };
  const title = page.seo_title || `${page.title} | لوکیشن ساری`;
  const description = page.seo_description || toDescription(page.body);
  return {
    title,
    description,
    alternates: { canonical: `/p/${page.slug}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function StaticContentPage({ params, searchParams }: Props) {
  const isPreview = searchParams?.preview === "1";
  const user = isPreview ? await getCurrentUser() : null;
  const canPreview = !!user && (await userHasPermission(user.id, "content.edit"));
  const page = await getPage(params.slug, canPreview);
  if (!page) notFound();

  const images = await getPageImages(page.id);
  const embedUrl = page.video_url ? toAparatEmbedUrl(page.video_url) : null;

  return (
    <div className="static-page">
      <h1>{page.title}</h1>
      {embedUrl && (
        <div className="static-page__video">
          <iframe src={embedUrl} allowFullScreen title={page.title} />
        </div>
      )}
      <div className="static-page__body">
        {page.body.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {images.length > 0 && (
        <div className="static-page__licenses">
          <h2>اعتبارات و مجوزات</h2>
          <div className="static-page__license-grid">
            {images.map((img) => (
              <figure key={img.id}>
                <img src={img.url} alt={img.alt_text ?? page.title} loading="lazy" />
                {img.alt_text && <figcaption>{img.alt_text}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

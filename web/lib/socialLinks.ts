// اعتبارسنجی و ذخیرهٔ Social Link های عمومی Agency/Consultant (فاز ۶، بخش ۲۵)
// Schema به چند Provider ثابت محدود نمی‌شود؛ فقط URL معتبر (http/https) لازم است.

import { DbOrTx } from "./propertyAttributes";
import { isValidHttpUrl } from "./validation";

export interface SocialLinkInput {
  provider: string | null;
  url: string;
}

export type SocialLinksValidationResult = { ok: true; links: SocialLinkInput[] } | { ok: false; error: string };

const MAX_LINKS = 10;

export function validateSocialLinks(raw: unknown): SocialLinksValidationResult {
  if (raw === undefined) return { ok: true, links: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "ساختار socialLinks نامعتبر است" };
  if (raw.length > MAX_LINKS) return { ok: false, error: `حداکثر ${MAX_LINKS} لینک مجاز است` };

  const links: SocialLinkInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || !("url" in item)) return { ok: false, error: "ساختار socialLinks نامعتبر است" };
    const url = (item as { url: unknown }).url;
    if (!isValidHttpUrl(url)) return { ok: false, error: "یکی از لینک‌های اجتماعی نامعتبر است" };
    const providerRaw = (item as { provider?: unknown }).provider;
    const provider = typeof providerRaw === "string" && providerRaw.trim() ? providerRaw.trim().slice(0, 30) : null;
    links.push({ provider, url });
  }
  return { ok: true, links };
}

/** جایگزینی کامل لینک‌های اجتماعی یک صاحب (Agency/Consultant) — ساده‌ترین الگوی سازگار با آرایهٔ ورودی فرم */
export async function replaceSocialLinks(
  trx: DbOrTx,
  ownerType: "agency" | "consultant",
  ownerId: number,
  links: SocialLinkInput[]
): Promise<void> {
  await trx.deleteFrom("social_links").where("owner_type", "=", ownerType).where("owner_id", "=", ownerId).execute();
  if (links.length === 0) return;
  await trx
    .insertInto("social_links")
    .values(links.map((l, i) => ({ owner_type: ownerType, owner_id: ownerId, provider: l.provider, url: l.url, sort_order: i })))
    .execute();
}

export async function getSocialLinks(trx: DbOrTx, ownerType: "agency" | "consultant", ownerId: number) {
  return trx
    .selectFrom("social_links")
    .select(["id", "provider", "url"])
    .where("owner_type", "=", ownerType)
    .where("owner_id", "=", ownerId)
    .orderBy("sort_order", "asc")
    .execute();
}
